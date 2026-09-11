---
title: "An idempotency key needs stored results: testing retries and concurrent requests"
published: false
tags: [api, cloudflare, database, testing]
canonical_url: https://zenn.dev/hirodeath/articles/idempotency-key-result-storage
---

When a create request produces no response, the client cannot distinguish failure before creation from a committed creation whose response was lost. Retrying can create a second record.

An idempotency key connects that retry to the same logical request. Preventing duplication also requires deciding how the server stores the key, input, and result.

This experiment put note creation and result storage into one local D1 `batch()`, then checked lost responses, concurrency, mismatched inputs, and deleted records. The investigation ran on September 11, 2026. It is a demonstration implementation, not a rollout to an existing application.

## Define what the same key identifies

[Stripe's idempotent-request documentation](https://docs.stripe.com/api/idempotent_requests) describes saving the first request's status code and body and returning that result for the same key. It also compares inputs and treats reuse after the record is removed as a new request.

That behavior requires more than a header name. It is also Stripe's contract: adding the same header name to a custom API does not automatically implement storage or comparison.

The experiment defined key scope using three components:

```text
Authenticated actor / operation and version / client key
actor-a / create-note:v1 / key-a
```

Another actor can use `key-a` for a separate creation. The same actor retrying the same operation returns to the original input and result. The actor is a trusted argument to the experimental function; HTTP authentication was not implemented.

## Store an input fingerprint and the response result

The result table was:

```sql
CREATE TABLE request_result (
  actor TEXT NOT NULL,
  operation TEXT NOT NULL,
  request_key TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  body TEXT NOT NULL,
  PRIMARY KEY(actor, operation, request_key)
);
```

The `fingerprint` is the SHA-256 of JSON containing the single experimental input, `title`. This is not a general normalization algorithm for arbitrary JSON. A real API must include every input that affects the operation.

If the key already exists, the function compares fingerprints and returns the stored result when they match. A mismatch produces an error carrying status `409` in this implementation. That is a demonstration-specific choice, not an attempt to reproduce Stripe's error contract.

For a new key, the function generates a note ID and stores both the note and the response containing that ID:

```js
await db.batch([
  db.prepare('INSERT INTO request_result VALUES (?, ?, ?, ?, ?, ?)')
    .bind(actor, operation, key, fingerprint, 201, JSON.stringify(body)),
  db.prepare('INSERT INTO note VALUES (?, ?, ?)')
    .bind(body.id, actor, title),
]);
```

`body` contains the generated ID and title. The surrounding [experiment code](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/d1-idempotency-outbox.mjs) also implements lookup, replay, and rereading after a write conflict.

The [D1 batch contract](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch) provides the transaction boundary for the two writes. This avoids preserving a successful response when creation of its note failed.

## An existence check alone does not handle concurrency

Two requests can both read that no key exists. The test introduced a barrier to force that situation:

```text
Request A: observes no key ─┐
                           ├─ Wait until both reads finish
Request B: observes no key ─┘

Then both execute their batches
```

The inserts compete for the same composite primary key. Only one batch succeeds as a new creation; the other rereads the saved result and compares the fingerprint before returning it.

Assertions verified that both initial lookups missed, only 1 note existed, and both calls returned the same body. The test did not infer concurrency safety merely from a run where one request happened to finish first.

The initial SELECT can provide a fast replay path. The unique constraint and atomic writes prevent duplicate creation at the final boundary. An in-process Map alone would not cover requests handled by another process.

## Return to the same ID after losing a response

The test threw an exception after creation committed to simulate a caller missing the success result. It did not interrupt actual HTTP traffic.

Calling the function again with the same actor, key, and title returned the original body and status value `201`, while the note count remained 1. Storing the result, rather than only a completion marker, lets the retried caller learn the same ID.

The full set of cases was:

| Condition | Result |
| --- | --- |
| Response lost after commit, followed by identical retry | Same body and 201; 1 note |
| Same actor and key, changed title | Rejected with 409; still 1 note |
| Another actor uses the same key | Separate note; 2 total |
| Both concurrent requests observe no key | 1 note, identical bodies, 1 creation and 1 replay |
| Note creation violates a CHECK constraint | 0 notes and 0 saved results |
| Saved result deleted before an identical retry | New note; 2 total |

The last case explicitly deleted the record to simulate the end of retention. Automatic TTL deletion was not implemented. If keys are not remembered forever, clients need to know what happens when the same request arrives after retention ends.

## This implementation caches only successful creation

The environment was Node.js `v24.15.0`, Wrangler `4.81.1`, and Miniflare `4.20260409.0`. Remote bindings were disabled; only local D1 and synthetic data were used.

The implementation atomically saves the note and its successful result. It does not reproduce a contract such as Stripe's that also retains failure results after execution begins. Authentication, input validation, replay of HTTP headers and the complete response, and retention operations require separate work.

The batch also contains only D1 writes. This mechanism alone cannot make an external notification or file transfer happen once. An external operation needs its own defined key and result-reuse behavior.

If duplicate business data must remain impossible after request records expire, enforce that condition in the business table too. The time window for deduplicating retries need not match the lifetime of a business uniqueness rule.

Review scope, input matching, concurrent creation, result replay, and post-deletion behavior alongside the presence of a key. Use those results to describe which duplicate operations the API prevents.
