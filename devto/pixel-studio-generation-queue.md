---
devto_id: 4439055
canonical_url: https://qiita.com/hiro123/items/2a648245aa396a45296e
title: Building a Generation Queue Tool for Batch Character Creation
tags: Nextjs, TypeScript, Queue, API
published: true
---

_This article is an English translation of the original Japanese article._

I added a batch generation queue to Pixel Studio, which creates game characters via an external API. Previously I had to open each idea one at a time and generate it, so wait time and click count scaled with the number of ideas.

The queue holds states like `queued`, `submitted`, `completed`, and `failed`, and handles character, animation, and idea generation in a single list.

## Finalize input when adding to the queue

The API accepts multiple entries and validates payloads by type.

```ts
type NewQueueEntry =
  | { type: "idea"; label: string; payload: { ideaId: string } }
  | { type: "character"; label: string; payload: CharacterPayload }
  | { type: "animation"; label: string; payload: AnimationPayload };
```

For ideas, it checks if an entry with the same ID is already `queued` or `submitted` to prevent duplicates. For animations, it validates direction, frame count, and character ID before insertion.

## Pump fills available slots

Queue processing is centralized in `pumpQueue`. It reconciles external job status, updates completed entries, then submits waiting entries to available concurrency slots.

```ts
await pumpQueue({ force: true });
return NextResponse.json({ entries: await listQueue() });
```

I don't run a dedicated worker. Instead, polling from the job screen or viewing the ideas screen drives the pump. After POST, I call pump from Next.js `after` and return the response immediately.

```ts
const added = await addQueueEntries(validated);
after(() => pumpQueue({ force: true }));
return NextResponse.json({ entries: added });
```

## Restrict failure and cancellation by state

Only queued entries can be canceled, only failed entries can be retried.

```ts
const result = await retryQueueEntry(id);
if (result === "not-retryable") {
  return apiError(new Error("失敗したエントリのみ再試行できます"), 400);
}
```

Deleting a job locally after submitting it to the external API loses tracking, so the API layer decides which states can transition to what.

## UI separates selection from progress

The ideas list lets you select multiple ungenerated ideas, choose whether to continue with animations, and add them to the queue. The job screen fetches every 10 seconds and displays queued, submitted, completed, and failed entries.

A simple bulk execute button doesn't handle partial failures or recovery after reload. Persisting the queue and storing external job IDs and states makes progress trackable even after closing the browser.
