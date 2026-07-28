---
devto_id: 4251703
title: "Drizzle's `with` is not a JOIN: peeking at the SQL it actually generates"
tags: typescript, orm, sqlite, cloudflare
canonical_url: https://qiita.com/hiro123/items/c435d34b201debc989aa
published: false
---

> This is a translation of my original article in Japanese: [Qiita](https://qiita.com/hiro123/items/c435d34b201debc989aa)

I run the backends of two side projects on Drizzle + Cloudflare D1, and I realized I had never actually checked what SQL the relational queries API (`db.query.xxx.findMany({ with: ... })`) produces.

Is it a JOIN? Or does it quietly turn into N+1 queries? I wired up a logger and measured it, and the answer was neither. Drizzle compiles the whole thing into a single SQL statement built from correlated subqueries and `json_group_array`. No matter how deep you nest relations, the query count stays at one.

This post walks through the actual SQL, pasted as measured.

## What I was worried about

Fetching a relation in Drizzle looks like this:

```ts
// Fetch members of an organization, with user info attached
const members = await db.query.memberships.findMany({
  where: eq(memberships.orgId, input.orgId),
  with: { user: { columns: { id: true, name: true, email: true } } },
});
```

Based on ORM instincts, I assumed this was either ActiveRecord-style lazy loading (the classic N+1 trap) or a JOIN that duplicates rows and reassembles them on the application side. D1's latency scales with the number of queries you send, so if this was N+1, that would be a real problem. That finally got me to check.

## How I measured

Drizzle accepts a custom logger at initialization, which captures every SQL statement it sends:

```ts
const queries: { query: string; params: unknown[] }[] = [];

const db = drizzle(client, {
  schema,
  logger: {
    logQuery(query, params) {
      queries.push({ query, params });
    },
  },
});
```

The schema is from a service I actually run (a sports club management app): `organization` one-to-many `membership` many-to-one `user`. Environment: drizzle-orm 0.41 + SQLite via libsql, the same SQLite dialect as D1.

## Test 1: many-to-one (memberships → user)

```ts
await db.query.memberships.findMany({
  with: { user: { columns: { id: true, name: true, email: true } } },
  limit: 3,
});
```

Query count: 1. Here is the SQL, formatted for readability:

```sql
select "id", "userId", "orgId", "role", "joinedAt",
  (select json_array("id", "name", "email") as "data"
   from (select * from "user" "memberships_user"
         where "memberships_user"."id" = "memberships"."userId"
         limit ?) "memberships_user"
  ) as "user"
from "membership" "memberships"
limit ?
```

Not a JOIN. It is a correlated subquery inside the SELECT clause. The related user gets serialized into a JSON array with `json_array(...)` and packed into a single column.

## Test 2: one-to-many (organizations → memberships)

```ts
await db.query.organizations.findMany({
  with: { memberships: true },
  limit: 2,
});
```

Again one query. For one-to-many, `json_group_array` shows up:

```sql
select "id", "name", "genre",
  (select coalesce(json_group_array(
            json_array("id", "userId", "orgId", "role", "joinedAt")
          ), json_array()) as "data"
   from "membership" "organizations_memberships"
   where "organizations_memberships"."orgId" = "organizations"."id"
  ) as "memberships"
from "organization" "organizations"
limit ?
```

`json_group_array` is SQLite's aggregate function that folds multiple rows into one JSON array. The interesting bit is `coalesce(..., json_array())`: when there are zero children you get an empty array instead of null. The type-level guarantee that `rows.memberships` is always an array is enforced at the SQL level.

## Test 3: two levels of nesting (organization → memberships → user)

```ts
await db.query.organizations.findMany({
  with: { memberships: { with: { user: { columns: { name: true } } } } },
  limit: 2,
});
```

Still one query. The subqueries simply nest:

```sql
select "id", "name", "genre",
  (select coalesce(json_group_array(
            json_array("id", "userId", "orgId", "role", "joinedAt",
              (select json_array("name") as "data"
               from (select * from "user" "..._user"
                     where "..._user"."id" = "organizations_memberships"."userId"
                     limit ?) "..._user")
            )), json_array()) as "data"
   from "membership" "organizations_memberships"
   where "organizations_memberships"."orgId" = "organizations"."id"
  ) as "memberships"
from "organization" "organizations"
limit ?
```

## For comparison: a plain leftJoin

```ts
await db.select().from(memberships)
  .leftJoin(users, eq(memberships.userId, users.id))
  .limit(3);
```

```sql
select "membership"."id", ..., "user"."id", "user"."name", ...
from "membership"
left join "user" on "membership"."userId" = "user"."id"
limit ?
```

This one is the straightforward JOIN you would expect. But a JOIN duplicates the parent row once per child, and reassembling that into a nested structure is your job. Relational queries push that reassembly into the SQL itself as JSON aggregation.

## Why this design is convenient on D1

The "one query no matter how deep" property pays off in environments where round trips are expensive.

D1 receives queries from a Worker through a binding, so query count translates directly into latency. If relational queries were N+1, a member list screen with 20 people would cost 21 round trips. In practice it is always one. I think this is part of why the D1 + Drizzle combination has felt smooth in production.

A few things to keep in mind:

- Folding a large number of child records through `json_group_array` produces one giant JSON string per row. Design your queries so limits apply to the child side too
- These are correlated subqueries, so indexes on the join keys (`membership.userId` and `membership.orgId` in this example) still matter
- The generated SQL is hard to read, so pair any slow-query investigation with `EXPLAIN QUERY PLAN`

## Closing

My assumption that `with` was syntactic sugar for a JOIN was wrong. It is closer to a compiler that emits a single JSON-building SQL statement.

A single logger is all it takes to peek inside an ORM. If there is a part of your stack you are using on a "probably fine" basis, measuring it is worth the ten minutes. It was for me.

## Environment

- drizzle-orm 0.41 / @libsql/client (SQLite dialect, same as Cloudflare D1)
- Schema and queries are simplified from a side project running in production
- The generated SQL may differ across dialects and drizzle versions. On PostgreSQL it appears to use lateral joins with JSON functions
