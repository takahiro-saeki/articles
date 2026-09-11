---
title: "SQLite foreign keys do not create child indexes: inspect a parent deletion plan"
published: false
tags: sqlite, sql, database, testing
canonical_url: null
---

Writing `REFERENCES parent(id)` in SQLite did not automatically create an index on the child's reference column. Referential-integrity checks still worked, but finding children during a parent deletion used a SCAN.

The existence of a foreign key and the access path used to find referencing children need separate checks. This experiment compared index lists and an actual DELETE plan in SQLite 3.53.1.

## Enable foreign keys and inspect the index lists

Each condition used a fresh in-memory database through Python's sqlite3 module. The connection enabled autocommit, and foreign_keys was turned ON outside a transaction.

```sql
PRAGMA foreign_keys = ON;
CREATE TABLE parent (id INTEGER PRIMARY KEY);
CREATE TABLE child (
  id INTEGER PRIMARY KEY,
  parent_id INTEGER NOT NULL REFERENCES parent(id)
);
```

The fixture contains 101 parents and 10000 children. Children reference parents 1 through 100 evenly; parent 101 has no children. Parent 1 therefore has 100 referencing children.

```sql
PRAGMA foreign_keys;
PRAGMA index_list(parent);
PRAGMA index_list(child);
```

With only the foreign key, foreign_keys returned `1`, while both parent and child index lists were empty. Inserting a child referencing missing parent 999 and deleting referenced parent 1 both failed with `FOREIGN KEY constraint failed`.

An absent index did not mean an inactive constraint. The parent's `INTEGER PRIMARY KEY` also has a rowid access path. An empty index list should not be interpreted as the absence of that access path.

## Deleting a parent searches the child table too

These two query plans were collected over the same data:

```sql
EXPLAIN QUERY PLAN SELECT rowid FROM child WHERE parent_id = 1;
EXPLAIN QUERY PLAN DELETE FROM parent WHERE id = 101;
```

The DELETE targets parent 101, which has no children. Determining that deletion is allowed still requires checking for referencing rows.

| Statement | Child-side operation with only the foreign key |
| --- | --- |
| SELECT rowid FROM child WHERE parent_id = 1 | SCAN child |
| DELETE FROM parent WHERE id = 101 | SCAN child |

The DELETE plan separately included `SEARCH parent USING INTEGER PRIMARY KEY (rowid=?)`. An efficient parent-key lookup did not automatically supply an access path for the child's reference column.

The [SQLite foreign-key documentation](https://sqlite.org/foreignkeys.html#fk_indexes) explains the child lookup involved in parent deletion and why child indexes are useful even though they are not required. The recorded DELETE plan exposed that child-side operation.

## Add an explicit child index

A separate comparison database used the same schema and data, plus this index:

```sql
CREATE INDEX child_parent_idx ON child(parent_id);
```

| Check | Foreign key only | With child index |
| --- | --- | --- |
| Number of child indexes | 0 | 1 |
| Child SELECT | SCAN child | SEARCH child USING COVERING INDEX child_parent_idx (parent_id=?) |
| Child lookup inside parent DELETE | SCAN child | SEARCH child USING COVERING INDEX child_parent_idx (parent_id=?) |
| DELETE referenced parent 1 | Constraint violation | Constraint violation |
| INSERT referencing a missing parent | Constraint violation | Constraint violation |
| DELETE unreferenced parent 101 | Success | Success |

The index changed the plan used to find children. It did not change which INSERTs and DELETEs were allowed.

This comparison did not measure execution time. A change from `SCAN` to `SEARCH` does not establish a speedup ratio. Index maintenance during writes and selectivity in real data also need separate evaluation before adoption.

## Do not confuse a parent's automatic index with a child index

Another condition declared the parent as `code TEXT UNIQUE` and the child as `code TEXT REFERENCES parent(code)`. The parent gained `sqlite_autoindex_parent_1`, with index origin `u`; the child's index list remained empty. An index created for the parent's UNIQUE constraint is not an index on the child's foreign-key column.

A final condition retained the child index but turned foreign_keys OFF. It allowed an orphan row to be inserted. `PRAGMA foreign_key_check` then reported that one violation. Check the connection's foreign_keys setting separately from its index list.

The tests ran on September 11, 2026, with Python 3.14.5, SQLite 3.53.1, in-memory databases, and synthetic data. The [reproduction code](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/sqlite-foreign-key-child-index.py) and [four-condition results](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/production/2026-09/batch-10/sqlite-results.json) are available. No remote D1 database or ORM migration was run.

The [official EXPLAIN QUERY PLAN documentation](https://sqlite.org/eqp.html) states that its output format can change between versions. The strings here are records from the tested version. In another environment, inspect the connection's enforcement setting, the child's index list, and the target DELETE plan together.
