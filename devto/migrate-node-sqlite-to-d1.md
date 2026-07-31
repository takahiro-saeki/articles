---
title: "Migrating a Next.js app from node:sqlite to Cloudflare D1"
tags: cloudflare, nextjs, sqlite, typescript
canonical_url: https://zenn.dev/hirodeath/articles/migrate-node-sqlite-to-d1
published: true
---

> This is an English translation of my original Japanese article on [Zenn](https://zenn.dev/hirodeath/articles/migrate-node-sqlite-to-d1).

I had a small Next.js app that ran locally with Node.js and a SQLite file. When I decided to deploy it to Cloudflare Workers so I could use it away from my desk, the database layer had to change. The app used Node's built-in `node:sqlite` module, which is not available in the Workers runtime.

I moved the database to Cloudflare D1. The SQL used by this app did not need to change. Most of the work was converting the database module from the synchronous `node:sqlite` API to D1's asynchronous API.

## Before the migration

The original database module used `DatabaseSync` from Node.js:

```ts
// src/server/db.ts, before the migration
import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync(DB_PATH);
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS clients ( ... );
`);

export function listClients(): Client[] {
  const rows = db.prepare(`SELECT * FROM clients ORDER BY created_at`).all();
  return rows.map(toClient);
}
```

The module created its schema during startup and ran every query synchronously. That was enough while the app only ran on my machine.

## The four changes

The migration came down to four tasks:

1. Move the schema into a migration file.
2. Rewrite the database module with D1's async API.
3. Retrieve the D1 binding from the Workers context.
4. Add `await` at each call site.

### 1. Move the schema into migrations

I moved the schema from the startup code into `migrations/0001_init.sql`:

```sql
-- migrations/0001_init.sql
CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

I removed `PRAGMA journal_mode = WAL` because D1 manages that part of the database. D1 also enforces foreign keys by default, so the app does not need to run `PRAGMA foreign_keys = ON`.

The same migration file can be applied locally and remotely:

```bash
wrangler d1 migrations apply my-db --local
wrangler d1 migrations apply my-db --remote
```

### 2. Rewrite the database module

D1's API is asynchronous, so each database function now returns a Promise:

```ts
// src/server/db.ts, after the migration
export async function listClients(): Promise<Client[]> {
  const { results } = await getDb()
    .prepare(`SELECT * FROM clients ORDER BY created_at`)
    .all<ClientRow>();
  return results.map(toClient);
}
```

The API mapping was fairly mechanical:

| node:sqlite | D1 |
|---|---|
| `.prepare(sql).all(...params)` | `.prepare(sql).bind(...params).all()` |
| `.prepare(sql).get(...params)` | `.prepare(sql).bind(...params).first()` |
| `.prepare(sql).run(...params)` | `.prepare(sql).bind(...params).run()` |
| `result.changes` | `result.meta.changes` |

The main differences were passing parameters through `bind()` and reading the number of changed rows from `meta`. The SQL used by this app stayed the same.

D1 does not expose an interactive `BEGIN` and `COMMIT` flow. When multiple statements need to run atomically, D1 accepts an array of prepared statements through `batch()`. Code that depends on an interactive SQLite transaction needs a separate design pass.

### 3. Get the D1 binding

In a Worker, the database is provided as a binding. This app runs Next.js through `@opennextjs/cloudflare`, so it reads the binding with `getCloudflareContext()`:

```ts
import { getCloudflareContext } from "@opennextjs/cloudflare";

function getDb() {
  return getCloudflareContext().env.DB;
}
```

The binding is declared in `wrangler.jsonc`:

```jsonc
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "my-db",
      "database_id": "replace with the output of wrangler d1 create",
      "migrations_dir": "migrations"
    }
  ]
}
```

### 4. Add await at the call sites

After the database functions became async, the route handlers also had to await them:

```ts
export async function GET() {
  return Response.json({ clients: await listClients() });
}
```

Changing the return types to Promise helped TypeScript find most missing `await` calls. I still tested the API routes because loosely typed code can hide mistakes from the type checker.

## Local development

For local development, I added `initOpenNextCloudflareForDev()` to `next.config.ts`:

```ts
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

initOpenNextCloudflareForDev();
```

The development server can then use the bindings from `wrangler.jsonc`, with local data stored under `.wrangler/state`. Local development and production now use the same database module and migration files. I still verify the app in a deployed development environment before releasing it because the local runtime is not the production D1 service.

If an existing SQLite file contains data, it can be exported as SQL and imported with:

```bash
wrangler d1 execute my-db --remote --file=dump.sql
```

My database was almost empty at the time of the migration, so I skipped that step.

## After the migration

Most of the work was the sync-to-async conversion. Keeping the database access in one small module made the affected code easy to find.

The app currently fits within the free limits for Workers and D1. Those limits are not unlimited, so I monitor rows read, rows written, and database size in Cloudflare.

## References

- [Cloudflare D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/)
- [Import and export data](https://developers.cloudflare.com/d1/best-practices/import-export-data/)
- [Cloudflare D1 limits](https://developers.cloudflare.com/d1/platform/limits/)
