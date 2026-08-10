---
title: Cloudflare D1 has no BEGIN TRANSACTION, so I tested its limits and batch API
tags: cloudflare, d1, sqlite, database
published: false
---

_This article is an English translation of the original Japanese article._

Cloudflare D1 is commonly described as SQLite-compatible, and most SQL works as expected. After migrating from local SQLite, however, I found several places where treating D1 like a normal SQLite connection fails.

The biggest difference is that D1 does not expose explicit transactions. I ran the commands myself to see the exact errors and then adjusted the application design around `batch()`.

## Test 1: `BEGIN TRANSACTION` is rejected

```bash
$ wrangler d1 execute my-db --local --command "BEGIN TRANSACTION"
```

```
D1 runs your SQL in a transaction for you.
Please export an SQL file from your SQLite database and try again.
```

The error is direct. D1 wraps an individual query, or a batch, in a transaction automatically. It does not let application code keep a connection open and choose an arbitrary `BEGIN` and `COMMIT` boundary.

Long interactive transactions are also a poor match for a serverless database connection model, so this limitation is part of the design rather than a missing SQLite command.

## Test 2: most PRAGMAs are restricted

I also tried applying a setting from the local SQLite setup.

```bash
$ wrangler d1 execute my-db --local --command "PRAGMA journal_mode = WAL"
```

```
✘ [ERROR] not authorized: SQLITE_AUTH
```

Low-level settings such as journal mode belong to D1's managed environment. They cannot be changed by the application. During migration, remove those `PRAGMA` statements from the schema. Foreign key enforcement is enabled by default, so `PRAGMA foreign_keys = ON` is not needed either.

## Use `batch()` for atomic groups of statements

A common requirement is to insert one record, update another, and roll everything back if either statement fails. D1 handles that with `batch()`.

```ts
// Raw D1 API
const results = await env.DB.batch([
  env.DB.prepare("INSERT INTO orders (id, user_id) VALUES (?, ?)").bind(orderId, userId),
  env.DB.prepare("UPDATE inventory SET stock = stock - 1 WHERE item_id = ?").bind(itemId),
]);
```

D1 runs the statements in a batch as one transaction and rolls back the entire batch when a statement fails. It also sends the statements in one round trip, which matters because each D1 query adds network latency.

Drizzle ORM exposes the same model through `db.batch([...])`.

```ts
await db.batch([
  db.insert(orders).values({ id: orderId, userId }),
  db.update(inventory).set({ stock: sql`${inventory.stock} - 1` }).where(eq(inventory.itemId, itemId)),
]);
```

## Read-then-write logic is the real design boundary

A batch works when the complete list of statements is known before execution. A typical interactive SQLite transaction may instead do this:

1. Read the current value with `SELECT`.
2. Make a decision in application code.
3. Run a different `UPDATE` based on that result.

There is no place for application-side branching inside a D1 batch. I usually handle that in one of these ways:

- Fold the condition into one statement. For example, run `UPDATE inventory SET stock = stock - 1 WHERE item_id = ? AND stock > 0`, then inspect whether `meta.changes` is zero.
- Use optimistic locking. Include the version read earlier in the `UPDATE` condition and retry if no row changes.
- Move the part that needs strict serialized access to Durable Objects. A single-entity coordination problem can be a better fit for DO storage than D1.

For the CRUD applications I migrated, moving the condition into one statement covered nearly every case. I did not end up with a feature that required an interactive transaction.

## SQLite habits and their D1 equivalents

| SQLite habit | D1 behavior |
|---|---|
| `BEGIN` ... `COMMIT` | Unavailable. D1 uses automatic transactions. |
| `PRAGMA journal_mode` and similar settings | Unavailable with `SQLITE_AUTH`. D1 manages them. |
| Atomic execution of multiple statements | Use `batch()` for one transaction and one round trip. |
| Read, decide, then write | Fold into `WHERE`, use optimistic locking, or use Durable Objects when needed. |

"SQLite-compatible" describes the SQL dialect, not an identical transaction model. Knowing that distinction before migration prevents designing around a connection model D1 does not provide.

## Environment

- Cloudflare D1 and Wrangler 4.113, tested with `--local`; remote D1 has the same restriction
- Drizzle ORM 0.41 batch API
