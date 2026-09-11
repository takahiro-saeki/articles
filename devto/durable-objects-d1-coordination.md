---
title: "Inventory cross-room queries before moving D1 data into Durable Objects"
published: false
tags: [cloudflare, architecture, database, distributed]
canonical_url: https://zenn.dev/hirodeath/articles/durable-objects-d1-coordination
---

When moving room state into Durable Objects, similar storage SQL does not mean every D1 query can move unchanged. Each Object has its own SQLite storage. Splitting data previously held in one D1 database also changes how you retrieve records across rooms.

This article tests that boundary. The experiment stored the same synthetic data in one local D1 database and two local Objects, then compared individual and cross-room reads. No live service was migrated. The migration steps later in the article are design proposals based on the experiment.

## Start with a query the migration must preserve

Consider a small room system: `alice` belongs to `red`, and `bob` belongs to `blue`. One D1 database can store both in this table:

```sql
CREATE TABLE membership (
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  PRIMARY KEY (room_id, user_id)
)
```

Besides listing members of a particular room, an administration screen can retrieve every membership with one query:

```sql
SELECT room_id, user_id FROM membership ORDER BY room_id, user_id
```

This full-table read is for comparison. A large administration screen needs pagination, and reading every row may be undesirable. The point here is that a query spanning room boundaries stays within one database.

The [Durable Object Storage specification](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/) describes storage attached to an individual Object. It is not a shared database that automatically brings another Object's tables into this `SELECT`.

## Create the same table in two Objects

The experimental `Room` class creates a `member` table during initialization and exposes RPC methods to add and retrieve members. Because the Object itself represents a room, this table has no `room_id` column.

```js
import { DurableObject } from 'cloudflare:workers';

export class Room extends DurableObject {
  /** @param {DurableObjectState} ctx @param {Env} env */
  constructor(ctx, env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS member (user_id TEXT PRIMARY KEY)');
    });
  }

  /** @param {string} userId */
  add(userId) {
    this.ctx.storage.sql.exec('INSERT INTO member (user_id) VALUES (?)', userId);
  }

  members() {
    return this.ctx.storage.sql.exec('SELECT user_id FROM member ORDER BY user_id').toArray();
  }
}
```

`Env` is generated from the Wrangler binding configuration. Here, `blockConcurrencyWhile` controls event delivery during initialization. This is not an example of putting a long external request inside that block; consult the [State API documentation](https://developers.cloudflare.com/durable-objects/api/state/) when choosing where to use it.

The caller obtains Objects by room name:

```js
const red = env.ROOMS.getByName('room:red');
const blue = env.ROOMS.getByName('room:blue');
await red.add('alice');
await blue.add('bob');
```

Using the same name in the same namespace provides a way back to the same storage. The [Namespace API](https://developers.cloudflare.com/durable-objects/api/namespace/) distinguishes named lookup from generating a new unique ID. Calling `newUniqueId()` on every request does not look up an existing room.

## What the local run returned

After completing the writes, the experiment performed the reads below. The harness passed 8 assertions, including the successful HTTP response.

| Read | Returned data |
| --- | --- |
| `members()` on `room:red` | Only `alice` |
| `members()` on `room:blue` | Only `bob` |
| Retrieve again using the same name, `room:red` | Only `alice` |
| A separate Object created with `newUniqueId()` | Empty array |
| Global D1 query | `blue/bob` and `red/alice` |
| Explicitly fetch both rooms over RPC and combine | Matches the global D1 query |
| Fetch and combine with only `red` in the target list | Only `red/alice` |

The application can still gather data after storage is split. This is the collection function used in the experiment:

```js
/** @param {Env} env @param {string[]} roomIds */
async function collectMembers(env, roomIds) {
  const groups = await Promise.all(roomIds.map(async roomId => {
    const room = env.ROOMS.getByName(`room:${roomId}`);
    const members = await room.members();
    return members.map(member => ({ room_id: roomId, user_id: member.user_id }));
  }));
  return groups.flat().sort((a, b) => a.room_id.localeCompare(b.room_id));
}
```

The caller is responsible for the room list. Getting 1 record after passing `['red']` does not establish that only 1 record exists globally. This experiment used a fixed room list; it implements neither enumeration of all Objects nor persistent management of that list.

Waiting for each RPC and combining the arrays does not create a transaction that reads all Objects at the same instant. The results matched here with writes stopped. A consistent global snapshot under concurrent updates was not tested. If any RPC fails, this `Promise.all` also fails. Whether to return partial results or repeat the entire read is a separate decision based on the screen's requirements.

## Decide where reads and writes will go before migrating

Based on this result, an investigation of a proposed migration can inventory existing queries as follows. The right column lists decisions to make, not features implemented in this experiment.

| Existing operation | Question after partitioning storage by Object |
| --- | --- |
| Retrieve members of one room | Can the room ID consistently reach the same Object? |
| Search all rooms in an administration screen | Keep aggregate data elsewhere, or collect from a known target list? |
| Find every room a user has joined | Where will an index starting from the user live? |
| Make a change affecting multiple rooms | How will partial success be detected and recovered? |

One possible design retains aggregate data in D1 for global search. That requires deciding which store owns updates, how much projection lag is acceptable, and what can rebuild missing updates. Sequential writes to D1 and an Object do not make the two stores one transaction. Writing the same data twice in this experiment prepared the comparison; it did not implement a synchronization mechanism.

Another option keeps data in D1 and uses Objects to coordinate communication or operations for a room. Conversely, storing data inside the Object can be useful when state should stay within the room boundary. Apply the combination of execution context and storage described in the [Durable Objects overview](https://developers.cloudflare.com/durable-objects/concepts/what-are-durable-objects/) to the unit of work in your application.

Inventory read and write paths to identify which cross-room operations must change, even though both stores use SQLite.

## Environment and reproduction

The experiment ran on September 11, 2026, with Node.js `v24.15.0`, Wrangler `4.131.0`, and its Miniflare dependency, `5.20260910.0-alpha`. The Worker's compatibility date was `2026-09-11`. The package's `convertV4MiniflareOptions` converted the older option format. Wrangler generated the types, and `checkJs` passed with `@cloudflare/workers-types` `5.20260911.1` and TypeScript `5.9.3`.

The [local experiment script](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/do-partitions.mjs) has its Worker and configuration in the adjacent `do-partitions/` directory. The [recorded output](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/production/2026-09/batch-04/do-partitions.json) is also available.

To reproduce it, install the specified Wrangler version in a separate scratch directory and pass the path to its `node_modules/wrangler/package.json` as the script argument. It does not connect to remote D1 databases or Objects. Storage is temporary, and the runtime is disposed at the end.

Performance, pricing, WebSockets, recovery across failures, and production data migration are outside this experiment. The results show the scope of reads after partitioning storage by Object and the application work needed for a global read.
