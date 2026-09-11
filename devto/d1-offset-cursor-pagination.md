---
title: "Replacing deep OFFSET pagination in D1: rows read and inserts between pages"
published: false
tags: [cloudflare, sql, database, performance]
canonical_url: https://zenn.dev/hirodeath/articles/d1-offset-cursor-pagination
---

`LIMIT 20 OFFSET ...` makes the next page of a list easy to express. But deeper pages require skipping more rows without returning them. Using an index does not, by itself, eliminate that work.

This experiment inserted 100,000 synthetic notifications into local D1 and fetched the same 20 records with OFFSET and a cursor. It examined how many rows were read and what happened when a new row arrived between pages.

The checks ran on September 11, 2026. They do not measure production D1 latency or billing, or establish a universal row count at which pagination becomes slow.

## Define a key that preserves the same order

The experimental schema was:

```sql
CREATE TABLE notification (
  id INTEGER PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_feed
  ON notification(user_id, created_at DESC, id DESC);
```

It contained 100000 rows for `user-a`, with `created_at` set to the integer part of the ID divided by 3. Multiple records therefore shared a timestamp.

The order was `created_at DESC, id DESC`. Timestamp alone cannot uniquely order tied rows, so the ID belongs in both the ordering and the cursor. This example assumes non-null ordering columns and a unique ID.

[SQLite's Row Values documentation](https://www.sqlite.org/rowvalue.html) describes comparing multiple columns together and applying that technique to scrolling lists. This experiment checked it in D1 SELECT statements.

## Retrieve the same 20 records with both methods

The OFFSET query skips a specified number of records from the beginning:

```sql
SELECT id, created_at
FROM notification
WHERE user_id = ?
ORDER BY created_at DESC, id DESC
LIMIT 20 OFFSET ?;
```

The cursor query searches after the last record of the previous page. Because the order is descending, the comparison uses `<`:

```sql
SELECT id, created_at
FROM notification
WHERE user_id = ?
  AND (created_at, id) < (?, ?)
ORDER BY created_at DESC, id DESC
LIMIT 20;
```

The cursor values are the previous page's final `created_at` and `id`. Using only `created_at < ?` could skip remaining rows sharing the boundary timestamp.

The measured positions were offsets 20, 1000, 10000, 50000, and 99000. For each comparison, the immediately preceding row was retrieved in advance. Finding that cursor was excluded from the measurement. A real “Next” action carries those values from the previous result; jumping directly to an arbitrary page number is a different operation.

## Rows read differ substantially from rows returned

At every position, the ID-and-timestamp arrays matched and contained 20 records. The final measured query's `meta.rows_read` values were:

| OFFSET position | Rows read with OFFSET | Rows read with cursor |
| --- | ---: | ---: |
| 20 | 40 | 23 |
| 1000 | 1020 | 22 |
| 10000 | 10020 | 22 |
| 50000 | 50020 | 23 |
| 99000 | 99020 | 21 |

The cursor did not always read exactly 20 rows; it read 21 to 23 in this dataset. OFFSET's reads increased with the position.

`EXPLAIN QUERY PLAN` showed both queries using the same covering index. The relevant output was:

```text
OFFSET:
SEARCH notification USING COVERING INDEX idx_feed (user_id=?)

Cursor:
SEARCH notification USING COVERING INDEX idx_feed (user_id=? AND created_at<?)
```

Check which condition defines the search starting point as well as whether an index is used. Equality of the returned arrays also verified that the comparison including `id` produced the intended results.

The [D1 index documentation](https://developers.cloudflare.com/d1/best-practices/use-indexes/) distinguishes returned rows from read rows and describes inspection using `EXPLAIN QUERY PLAN` and `meta.rows_read`. These numbers came from local Miniflare; they are not production-billing measurements.

## Timing does not establish one universal cutoff

The environment was macOS/arm64 on an Apple M4 Max, Node.js `v24.15.0`, Wrangler `4.81.1`, and Miniflare `4.20260409.0`. The configuration specified compatibility date `2026-09-11`, but this version of `getPlatformProxy` does not pass that date to the Worker it creates. The measurements cover this local D1 implementation, not Worker behavior for the requested date. Remote bindings were disabled and local D1 persistence was off.

Each position had 4 warmup rounds followed by 11 measured rounds. Query order alternated between OFFSET and cursor. `performance.now()` measured the wait for `.all()`, including local proxy overhead but excluding cursor preparation and result assertions.

| OFFSET position | OFFSET median ms | Cursor median ms |
| --- | ---: | ---: |
| 20 | 1.435 | 1.219 |
| 1000 | 1.113 | 0.990 |
| 10000 | 1.026 | 1.084 |
| 50000 | 1.809 | 1.123 |
| 99000 | 2.971 | 1.137 |

At shallow positions, call-to-call variation matters; the medians even reversed at 10000. The cursor at the first position had a maximum observation of 9.911 ms. This table does not justify a universal rule such as switching at 10000 records.

The clearer finding is that deeper OFFSET queries read more rows, with timing differences also appearing at the deeper positions in this run. A production decision needs measurements against the real distribution, page size, query frequency, and response-time target.

## Inserting between pages produces an OFFSET overlap

The test also fetched the first 20 records, then inserted 1 new row ahead of them.

The first page ended at ID `99981`. Fetching the next page with `OFFSET 20` after the insertion returned `99981` again as its first row. The new leading record pushed the previous twentieth record into the twenty-first position.

Using the saved cursor instead returned `99980` first, with no IDs overlapping the previous page. Assertions checked that result too.

A cursor is not a snapshot of the entire list, however. Updating ordering values between requests, or reproducing the same list including deleted records, needs additional rules. The mutation test here covered only 1 insertion at the beginning.

## Start with lists that need a Next action

Cursor pagination receives its next position from the preceding page. An interface that jumps directly to a page number must locate that position separately. Excluding cursor preparation from this experiment's timing makes that distinction explicit.

The [reproduction code](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/d1-pagination.mjs) includes data creation, result equality, query plans, measurements, and the insertion test. Alongside index usage, check that the methods return the same records and how much each reads to reach the next page.
