---
title: Batch Design That Retries 429 Rate Limits While Allowing Partial Failures
tags: TypeScript, Nextjs, API, Retry
published: false
---

_This article is an English translation of the original Japanese article._

When submitting multiple image generation requests sequentially to an external API, I started receiving 429 responses due to concurrent job limits. If the API route immediately returned 500, the client would re-execute everything, duplicating previously successful requests.

The solution was to retry only 429s on the server, skip requests that still fail after retries, and return the successful results.

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

Batches that call external APIs require separating HTTP request success from per-item success. When the API cannot roll back partially created resources, returning partial success prevents duplication better than re-running everything.
