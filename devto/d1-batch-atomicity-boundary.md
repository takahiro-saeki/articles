---
devto_id: 4737573
title: "Zero updated rows do not fail a D1 batch: testing the rollback boundary"
published: true
description: "A local D1 experiment separates SQL errors, zero-row updates, and JavaScript exceptions after a batch has completed."
tags: cloudflare, sql, database, javascript
canonical_url: https://zenn.dev/hirodeath/articles/d1-batch-atomicity-boundary
---

Suppose a D1 `batch()` reduces stock and then saves an order. If the UPDATE affects zero rows when stock is insufficient, will the order also remain unsaved?

In a local D1 binding experiment, the INSERT succeeded even when the UPDATE affected zero rows. Throwing a JavaScript exception after `batch()` returned did not remove the saved order.

SQL failure and an unfulfilled business operation need separate treatment. `batch()` provides atomicity when SQL fails. It does not automatically turn the application's conclusion that stock was unavailable into a SQL error.

## Start with a SQL statement that fails

The official [D1Database documentation](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch) describes sequential execution of the statement array, aborting or rolling back the sequence if a statement fails. The result array corresponds to the input statement order.

This small schema makes it possible to examine what qualifies as failure. It is an experiment about the guarantee, not a change deployed to a real inventory service.

```sql
CREATE TABLE stock (
  id INTEGER PRIMARY KEY,
  remaining INTEGER NOT NULL CHECK (remaining >= 0)
);
CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  quantity INTEGER NOT NULL
);
```

Before each case, the tables are reset and `stock` receives a row with `id = 1` and `remaining = 1`.

First, an UPDATE reduces the stock by one, followed by an INSERT using an order ID that was already registered before the batch:

```js
await db.batch([
  db.prepare("UPDATE stock SET remaining = remaining - 1 WHERE id = 1"),
  db.prepare("INSERT INTO orders VALUES (?, ?)").bind("duplicate", 1),
]);
```

The call throws a primary-key uniqueness error. Reading the database after catching it shows that the remaining stock is back to one and only the previously registered order exists. The earlier UPDATE was rolled back too.

In a separate successful batch containing UPDATE, INSERT, and SELECT, the final SELECT returned the updated remaining stock of zero. This also confirmed that later statements can observe earlier changes in the sequence.

## No matching row is not a SQL error

Next, try to order two units when only one remains:

```js
const result = await db.batch([
  db.prepare(
    "UPDATE stock SET remaining = remaining - ? WHERE id = 1 AND remaining >= ?",
  ).bind(2, 2),
  db.prepare("INSERT INTO orders (id, quantity) VALUES (?, ?)")
    .bind("order-b", 2),
]);

console.log(result.map(item => item.meta.changes));
```

The output was `[0, 1]`. The UPDATE changes nothing because the remaining stock fails its predicate. The statement itself does not fail, however. The INSERT succeeds, leaving stock at one and saving an order for two units.

There is no JavaScript branch inside this batch that examines the UPDATE result and cancels the INSERT. Both statements were placed in an array and submitted in advance.

A conditional UPDATE can help determine whether an individual update occurred. When another table's update must depend on that outcome, you also need to design how zero affected rows influence the later operation.

## Throwing after the batch is too late

After receiving the result, the experiment ran this check:

```js
if (result[0].meta.changes !== 1) {
  throw new Error("No stock was reserved");
}
```

The exception occurs. Reading the database after catching it still finds `order-b`. By the time `await db.batch(...)` returns successfully, its SQL execution has completed. A later JavaScript exception does not undo that batch.

| Case | SQL result | Final remaining stock | Orders |
| --- | --- | ---: | --- |
| Successful update and registration of one unit | Success | 0 | One new order |
| Duplicate ID in later INSERT | Error | 1 | Only the preexisting order |
| Two-unit request excluded by WHERE | Success, changes are zero and one | 1 | One new two-unit order |
| Negative stock rejected by CHECK | Error | 1 | Zero orders |

The final row comes from the following variation.

## Can a constraint express the invalid outcome?

The fixture includes a CHECK constraint that disallows negative stock. Removing the stock predicate from the UPDATE makes a two-unit decrement violate that constraint:

```js
await db.batch([
  db.prepare("UPDATE stock SET remaining = remaining - ? WHERE id = 1")
    .bind(2),
  db.prepare("INSERT INTO orders (id, quantity) VALUES (?, ?)")
    .bind("order-c", 2),
]);
```

This case fails with a CHECK error, leaving one unit and zero orders. For this input, expressing the invalid business outcome as a SQL constraint violation makes the entire batch fail.

The snippet is not a complete inventory system. If the stock row with `id = 1` does not exist, the UPDATE still affects zero rows. Validating quantities, relating products to orders, repeated order submissions, and multiple products are also outside this experiment. One CHECK constraint does not detect every unsuccessful business operation.

When choosing an implementation, list the conditions that should count as failure. For each one, determine whether SQL throws or completes successfully with zero changes. For the latter, examine whether conditions or constraints within SQL can connect it to the later update, or whether the unit of work needs to change.

## Reproduction environment and limits

The experiment ran on September 11, 2026, with Node.js `v24.15.0`, Wrangler `4.81.1`, and Miniflare `4.20260409.0`. Wrangler's [getPlatformProxy](https://developers.cloudflare.com/workers/wrangler/api/#getplatformproxy) supplied the local D1 binding with `persist: false` and `remoteBindings: false`. The configuration requested compatibility date `2026-09-11`.

The [experiment script](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/d1-batch.mjs) includes table creation, all four cases, and assertions on the resulting rows. Its first argument is the path to an installed Wrangler package's `package.json`:

```bash
node experiments/article-stock-2026-09/d1-batch.mjs \
  ../circle-hub-multi-device-push/apps/web/node_modules/wrangler/package.json
```

The local binding is an emulation of production. This is not a load or failure test against production D1. It also does not test lost network responses, external payment or notification systems, or multiple concurrent requests.

A later `throw` did not undo the batch that had already returned successfully. Grouping statements is only part of the work: identify which SQL statement expresses each invalid outcome as an error.
