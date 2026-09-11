---
title: "What reversing a D1 composite index changes in the query plan"
tags: cloudflare, database, sqlite, sql
canonical_url:
published: false
---

For a notification query using `WHERE user_id = ? AND created_at >= ?`, indexes on `(user_id, created_at)` and `(created_at, user_id)` do not behave identically.

In a local D1 comparison, the first plan showed both user and creation time as search constraints. The reversed index showed creation time alone. The experiment examines the planned search range. It does not measure response time.

## Fix the query before comparing indexes

The example takes the user and creation-time fields from SquadNote's notification table and keeps only the necessary columns. It does not change an operational database or its indexes.

```sql
CREATE TABLE notification (
  id INTEGER PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
```

Consecutive integers stand in for timestamps. The fixture contains rows numbered 1 through 10,000, distributed across 100 users.

```sql
WITH RECURSIVE seq(n) AS (
  SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 10000
)
INSERT INTO notification(id,user_id,created_at)
SELECT n, 'user-' || (n % 100), n FROM seq;
```

The SELECT stays unchanged:

```sql
SELECT id FROM notification
WHERE user_id = 'user-42' AND created_at >= 9000
ORDER BY created_at DESC;
```

`user_id` supplies equality, while `created_at` supplies a range and ordering. The question is which column order supports this query, not which column is more important in general.

## Execute against Wrangler's local database

The experiment ran on September 11, 2026, using Node.js `v24.15.0` and Wrangler `4.81.1`. The [SQL and configuration](https://github.com/takahiro-saeki/articles/tree/codex/article-stock-2026-09/experiments/article-stock-2026-09/d1-index) are included in the repository.

```bash
npx wrangler@4.81.1 d1 execute article-index-lab --local \
  --config experiments/article-stock-2026-09/d1-index/wrangler.jsonc \
  --file experiments/article-stock-2026-09/d1-index/compare.sql \
  --persist-to /tmp/article-stock-d1-index-lab --json
```

The SQL recreates the experimental table. `--local` and a dedicated persistence directory keep this separate from production. The configured database ID is a dummy value for local use. The [official CLI reference](https://developers.cloudflare.com/d1/wrangler-commands/#execute) documents `--local` and `--persist-to`.

An attempt to inspect the internal SQLite version with `sqlite_version()` was rejected in this environment. The internal version was not obtained.

## Compare no index, equality first, and range first

The experiment prefixes the SELECT with `EXPLAIN QUERY PLAN` and swaps one index for the other.

```sql
CREATE INDEX idx_user_created ON notification(user_id, created_at);
```

The reversed definition is below. Both indexes were not installed together for the comparison.

```sql
CREATE INDEX idx_created_user ON notification(created_at, user_id);
```

The resulting `detail` fields were:

```text
No index:
SCAN notification
USE TEMP B-TREE FOR ORDER BY

(user_id, created_at):
SEARCH notification USING COVERING INDEX idx_user_created (user_id=? AND created_at>?)

(created_at, user_id):
SEARCH notification USING COVERING INDEX idx_created_user (created_at>?)
```

Without an index, the plan scans the table and uses a temporary B-tree for sorting. `(user_id, created_at)` searches the time range within the selected user. The reversed index starts with the time range and applies the user condition as further filtering.

Although the plan displays `created_at>?`, both queries execute `created_at >= 9000`. Their returned IDs were checked too.

SQLite's [Query Planning documentation](https://sqlite.org/queryplanner.html) explains ordering by the leftmost columns of a composite index. The difference here is whether equality fixes the first column before searching the time range within it.

## Covering does not establish equivalent search ranges

Both indexed plans say `COVERING INDEX`. The query selects only `id`, and this table's `INTEGER PRIMARY KEY` aliases rowid. Being able to retrieve the needed values from the index does not mean the two indexes search the same range.

Do not conclude that reversing the index is equivalent simply because both plans are covering. Also read which constraints appear inside the parentheses after `SEARCH`.

Cloudflare's [index documentation](https://developers.cloudflare.com/d1/best-practices/use-indexes/) provides another starting point for checking an index against a query. Production rows read and billing effects were not measured here.

## Check that the returned rows remain identical

Both indexed variants returned 10 rows with an ID sum of 94,920. Assertions also verified this exact ID sequence:

```text
9942, 9842, 9742, 9642, 9542, 9442, 9342, 9242, 9142, 9042
```

This helps check that the SELECT has not accidentally changed while improving its plan. Different sets can share a count and sum, so this small result was compared directly as an ordered list of IDs.

The fixture has an artificial, even distribution. A production workload concentrated on particular users, or a query filtering only by time, needs its own assessment. The cost of maintaining indexes during writes was not compared either.

For this query, putting equality on `user_id` first produced a plan using both constraints for the search. For another query, compare the SELECT, query plan, and returned rows together instead of choosing by column names alone.
