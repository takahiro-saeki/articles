---
title: "An outbox preserves notification intent; delivery deduplication is a separate boundary"
published: false
tags: [cloudflare, database, distributed, testing]
canonical_url: https://zenn.dev/hirodeath/articles/outbox-database-notification-boundary
---

Saving a record before calling a notification API leaves a gap where execution can stop. The data exists, but there is no record that a notification was required. Reversing the order can notify someone about data that never saved successfully.

The outbox pattern saves business data and an event to deliver later in the same database transaction. That does not, by itself, make external delivery happen once.

This experiment put note creation and outbox insertion into one local D1 batch, then tested a consumer stopping after successful transmission. It ran on September 11, 2026, with a fake external provider. No actual notifications or production changes were made.

## Persist notification intent first

[AWS's transactional outbox guidance](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html) addresses inconsistencies between database updates and message delivery. Business data and the event are stored in one transaction and delivered afterward. Duplicate delivery still needs handling.

The experiment placed a `note` table and this `outbox` table in the same D1 database:

```sql
CREATE TABLE outbox (
  event_id TEXT PRIMARY KEY,
  note_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind = 'note.created'),
  payload TEXT NOT NULL,
  sent INTEGER NOT NULL DEFAULT 0
);
```

`event_id` identifies the persisted event rather than being regenerated for every delivery attempt. The JSON `payload` contains the note ID and its title at that point. Retries do not reread the current note, so the same event retains its contents.

One batch receives the two inserts:

```js
await db.batch([
  db.prepare('INSERT INTO note VALUES (?, ?, ?)')
    .bind(id, 'actor-a', 'hello'),
  db.prepare('INSERT INTO outbox(event_id,note_id,kind,payload) VALUES (?, ?, ?, ?)')
    .bind('event-'+id, id, kind, payload),
]);
```

This is an excerpt from the [verification code](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/d1-idempotency-outbox.mjs). The transaction provided by D1's [batch API](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch) covers those database writes. Sending to an external service does not participate in it.

## Does a failed event insert leave the note behind?

The outbox CHECK constraint permits only `note.created`. Passing an invalid kind forced the second INSERT to fail.

The result was 0 notes and 0 outbox events. The earlier note insertion was rolled back too.

A valid creation produced 1 note and 1 outbox event before the consumer ran. Calling the consumer afterward delivered 1 event to the fake provider. This verified that delivery can start separately from business creation using the event stored in the database.

That differs from merely deferring a notification Promise: the input required to resume delivery exists as a database record. However, this local experiment disabled persistence. It did not restart an actual process or host to test storage durability.

## Successful transmission can still precede a missing sent record

The experimental consumer follows this order:

```text
Read one unsent event
Pass event_id and payload to the provider
Wait for successful transmission
Update outbox.sent to 1
```

If the consumer stops before that final update, the provider has processed the event while the outbox still marks it unsent.

The test threw immediately after the fake provider returned success. Calling the consumer again against the same database transmitted that event again. It simulated interruption between transmission and recording with an exception rather than forcibly terminating a process.

Without provider deduplication, there were 2 calls and 2 operations counted as deliveries. The outbox's sent flag alone did not prevent the duplicate in this interval.

Setting `sent` to 1 before transmission would create the opposite problem: a failed send could disappear from the retry set. Reordering one flag cannot atomically align the provider's result with the database's result.

## A receiver that recognizes the event can consolidate retries

The next case used a fake provider that treated the same `event_id` and payload as an existing result. The test would fail if an identical ID arrived with different contents.

After the same interruption and retry, the provider received 2 calls but counted only 1 delivery:

| Condition | Database or provider result |
| --- | --- |
| Constraint failure on outbox INSERT | 0 notes, 0 events |
| Commit succeeds before consumer starts | 1 note, 1 event, 1 delivery |
| Interruption after send, no provider deduplication | 2 calls, 2 deliveries |
| Same interruption, provider deduplicates by event_id | 2 calls, 1 delivery |

After retry, `sent` was 1. A further consumer call also confirmed that no unsent event remained.

The provider is a fake running inside Node.js. Its deduplication records never expire, and it does not represent the guarantee of an actual notification service. A real integration must verify which key the receiver remembers, for how long, and within which scope.

If the receiver cannot make the effect happen once, design the consuming experience for possible duplicates. Introducing an outbox is insufficient evidence for exactly-once delivery.

## Separate the single-consumer experiment from operational requirements

The environment was Node.js `v24.15.0`, Wrangler `4.81.1`, and Miniflare `4.20260409.0`. Remote D1 bindings were disabled, with synthetic data and the fake provider used throughout.

The implementation calls one consumer sequentially. It has no claim or lease preventing multiple workers from selecting the same unsent row, no retry schedule, no failure limit, and no dead-letter queue. These tests do not justify scaling it directly to multiple consumers.

In operation, expose the pending-event count, longest waiting time, and failure reasons. If the provider stops, preserve events for retries and investigation. When changing the payload schema, also check whether the new consumer can still read old pending events.

This experiment verified atomic storage of business data and delivery intent, retrieval before delivery, and redelivery after interruption between sending and recording. An outbox closes the gap in which business data changes while notification intent is lost. Preventing duplicates beyond that boundary also requires a design for the receiver of the same event.
