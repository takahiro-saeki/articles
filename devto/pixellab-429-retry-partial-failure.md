---
canonical_url: https://qiita.com/hiro123/items/c8e2c8e6975d98487f9f
devto_id: 4318449
title: How I Stopped 429 Retries from Duplicating Successful Batch Jobs
tags: devchallenge, bugsmash, typescript, nextjs
published: true
---

_This article is an English translation of the original Japanese article._

*This is a submission for [DEV's Summer Bug Smash: Smash Stories](https://dev.to/bugsmash) powered by [Sentry](https://sentry.io/).*

When submitting multiple image generation requests sequentially to an external API, I started receiving 429 responses due to concurrent job limits. If the API route immediately returned 500, the client would re-execute everything, duplicating previously successful requests.

The solution was to retry only 429s on the server, skip requests that still fail after retries, and return the successful results.

## Why returning 500 made the bug worse

The external service creates jobs independently. Once a job has been accepted, my API cannot roll it back just because a later item fails. Returning one generic 500 made the client believe the whole batch had failed, even though the external system was already processing some items.

When the user retried, those successful items were submitted again. The visible error therefore encouraged the exact action that created duplicate jobs and additional rate-limit pressure.

## Narrow the retry scope

Retrying all errors would include invalid input and authentication failures. I targeted only 429 and concurrent limit messages from the external API.

```ts
const RATE_LIMIT_RETRIES = 5;
const RATE_LIMIT_WAIT_MS = 20_000;

async function createWithRetry(payload: Record<string, unknown>) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await createCharacterV3(payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const rateLimited =
        message.includes("429") || message.includes("concurrent");

      if (!rateLimited || attempt >= RATE_LIMIT_RETRIES) throw error;
      await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_WAIT_MS));
    }
  }
}
```

Currently using a fixed 20 seconds. If the API provides `Retry-After`, prioritizing that value would reduce wasted wait time.

## Don't discard everything on one failure

Save generation results and errors in separate arrays.

```ts
const created = [];
const errors = [];

for (let index = 1; index <= variations; index++) {
  try {
    const result = await createWithRetry(buildPayload(index));
    created.push({
      characterId: result.characterId,
      jobId: result.jobId,
      name: buildName(index),
    });
  } catch (error) {
    errors.push({
      name: buildName(index),
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
```

Return both arrays with 200 if at least one succeeded.

```ts
if (created.length === 0) {
  return apiError(new Error(errors[0]?.error ?? "生成に失敗しました"));
}

return NextResponse.json({
  characterId: created[0].characterId,
  jobId: created[0].jobId,
  characters: created,
  errors,
  status: "processing",
});
```

Keeping the first two fields maintains compatibility with existing clients that assume single generation.

## Clients can resubmit only failures

Returning success and failure separately lets the UI show "accepted 2 of 3 variations, 1 failed." Not treating the whole batch as an error preserves the external job IDs for successful requests.

## The impact of the fix

The endpoint now reports the real state of the batch instead of flattening it into success or failure. Accepted jobs remain visible to the client, failed items can be retried selectively, and a transient limit no longer causes already accepted work to be duplicated.

I verified these cases separately:

- All items are accepted on the first attempt.
- A 429 succeeds after a retry.
- One item exhausts its retries while other items succeed.
- Every item fails, producing a request-level error.
- A non-rate-limit error is not retried.

Batches that call external APIs require separating HTTP request success from per-item success. When the API cannot roll back partially created resources, returning partial success prevents duplication better than re-running everything.

The broader lesson is that an HTTP response should describe what actually happened, not merely whether every loop iteration completed. Partial failure is a domain state, and modeling it explicitly made both retry behavior and the user interface safer.
