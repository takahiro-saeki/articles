---
title: "Preventing Concurrent Attendance Updates with Unique Constraints, Audit Logs, and Idempotent Notifications"
tags: cloudflare, database, typescript, architecture
canonical_url: https://zenn.dev/hirodeath/articles/attendance-waitlist-concurrency-control
published: false
---

This is an English version of my [original Japanese article](https://zenn.dev/hirodeath/articles/attendance-waitlist-concurrency-control).

In a [previous article](https://zenn.dev/hirodeath/articles/attendance-capacity-waitlist-proxy-design), I described a waitlist design that calculates order from the time each person responded. A comment on that article made me reconsider what happens when several people update the same event at nearly the same time.

SquadNote can recalculate the waitlist from the original attendance records. It does not, however, strictly serialize the whole process from an attendance update through a promotion notification. The design in this article is not implemented yet. It is a record of the protections I want to add next.

## Where concurrent updates can collide

The cancellation flow looks roughly like this:

```ts
const before = await loadWaitlist(scheduleId);

await updateAttendance(scheduleId, userId, "not_attending");

const after = await loadWaitlist(scheduleId);
const promoted = findPromotedMembers(before, after);

await notifyPromotedMembers(promoted);
```

When requests arrive one at a time, this produces the expected result. The problem begins when two cancellations arrive almost together. Both requests may read the same state before the update, then see two newly available places afterward. They can identify the same person as promoted and send that notification twice.

Recalculating waitlist status avoids storing a stale rank in the database. It does not make several database operations behave as one event.

## Decide which rules must hold

I narrowed the requirements to four invariants before choosing any mechanism.

| Invariant | What it protects |
| --- | --- |
| Unique attendance | One attendance row per person and event |
| Stable waitlist order | The same input always produces the same order |
| Operation history | Who changed what, when, and why remains traceable |
| Idempotent notifications | Retrying an operation does not create another notification |

No single mechanism protects all four. The design combines database constraints, an operation log, notification deduplication, and serialization where it is actually needed.

## Add a composite unique constraint

The first protection belongs in the database, not in an application-side existence check. The current `attendance` table has separate indexes for `scheduleId` and `userId`, but the combination is not unique.

With Drizzle, I can define it like this:

```ts
import { index, uniqueIndex } from "drizzle-orm/sqlite-core";

export const attendances = createTable(
  "attendance",
  (d) => ({
    id: d.text().primaryKey(),
    scheduleId: d.text("schedule_id").notNull(),
    userId: d.text("user_id").notNull(),
    status: d.text("status").notNull(),
  }),
  (t) => [
    index("attendance_schedule_idx").on(t.scheduleId),
    index("attendance_user_idx").on(t.userId),
    uniqueIndex("attendance_schedule_user_unique").on(
      t.scheduleId,
      t.userId,
    ),
  ],
);
```

The constraint prevents two attendance rows from being created when registration requests for the same user overlap. Before adding it, I need to check the existing data for duplicates.

```sql
SELECT schedule_id, user_id, COUNT(*) AS count
FROM circle-hub_attendance
GROUP BY schedule_id, user_id
HAVING COUNT(*) > 1;
```

If duplicates exist, I need to decide which row to retain before applying the constraint. A unique constraint prevents the next duplicate. It does not repair an old one.

## Record an operation instead of a boolean

The current implementation uses `updatedByAdmin` to indicate whether an administrator submitted the change for someone else. That is enough for display, but it does not tell me who made the change, what the previous value was, or why it changed.

I want a separate append-only operation log:

```ts
type AttendanceOperation = {
  id: string;              // operationId for one user action
  scheduleId: string;
  targetUserId: string;
  actorUserId: string;
  beforeStatus: string | null;
  afterStatus: string | null;
  reason: string | null;
  createdAt: Date;
};
```

Keeping `targetUserId` separate from `actorUserId` lets the same record represent both self-service and proxy input. The client supplies an operation ID and reuses it if a timed-out request is retried. Making that ID unique also keeps the retry from creating another log entry.

The attendance update and its audit record should be committed atomically. Otherwise, an update can succeed without leaving a record of the operation that caused it.

## Save notification intent before sending

The current flow inserts an in-app notification after detecting a promotion, then sends a push notification. A retry in the middle can produce duplicates.

I want to put an outbox between the state change and delivery.

```ts
type NotificationOutbox = {
  id: string;
  operationId: string;
  recipientUserId: string;
  type: "waitlist_promoted";
  payload: string;
  deliveredAt: Date | null;
};
```

A unique constraint on `operationId + recipientUserId + type` prevents the same operation from creating the same delivery request twice. The attendance update, operation log, and outbox insert are committed together. A separate delivery job reads unsent rows and sets `deliveredAt` after sending.

This makes retries of one operation safe. It does not eliminate every concurrent update problem. Two different cancellations have different operation IDs, so they can still identify the same waitlisted person as promoted.

There is also a smaller but unavoidable edge case around external push delivery. If the provider accepts a push and the process fails before `deliveredAt` is written, the job may send it again. The delivery side still needs to assume retries can happen.

## What belongs in a D1 batch

Cloudflare D1's [`batch()`](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch) sends several prepared statements in one call. D1 executes the statements sequentially, and a failure aborts or rolls back the sequence.

This works well when the statements are known in advance, such as updating attendance, appending an operation record, and inserting an outbox row.

The harder case reads the previous state, calculates the promoted person in TypeScript, then decides which writes to issue. Application code cannot branch in the middle of a D1 batch.

One option is to move the promotion calculation into SQL so the whole change fits in one batch. Another is optimistic concurrency with a revision number per event. If the revision changed after the read, the handler recalculates before creating side effects.

A zero-row update does not automatically make the entire batch fail, so the design also needs a guard that aborts the sequence when the revision check loses the race. Simply placing a `SELECT` and an `UPDATE` in a batch does not serialize the application-level decision between them.

## Serialize per event only when necessary

If updates to one event must run in a strict order, I can route each `scheduleId` to its own [Durable Object](https://developers.cloudflare.com/durable-objects/).

Forwarding requests through a Durable Object is not enough by itself. Awaiting external I/O, including a call to D1, can allow another request to run while the first one is waiting. For strict ordering, the state needed to decide waitlist promotion can live in the Durable Object's own [SQLite storage](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/). The attendance change, operation log, and outbox insert can then complete together in local storage.

That design is more involved than using D1 alone. I do not think it belongs in the first version for groups with dozens of participants and rare concurrent updates.

## The order I would use for SquadNote

I would start with the composite unique constraint and operation IDs. Next, I would add the audit log and notification outbox to the same atomic write, then write a concurrent test that reproduces a duplicate promotion notification.

If that test exposes a race that does not fit into one D1 batch, I would try revision-based retries. I would move a schedule into a Durable Object only after the product requires strict ordering.

The unique constraint protects attendance rows but not promotion notifications. The outbox protects retries of one operation but not races between different operations. Mapping each failure to the layer that can prevent it keeps the first implementation smaller.
