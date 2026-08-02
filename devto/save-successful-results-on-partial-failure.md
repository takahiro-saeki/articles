---
title: API Design That Allows Partial Failures and Saves Only Successful Assets
tags: TypeScript, API, Batch, Nextjs
published: false
---

_This article is an English translation of the original Japanese article._

When generating, saving, and updating multiple assets to adopted state, treating one failure as total failure makes re-execution difficult. It also creates a mismatch where the external API has images but local history does not.

In Pixel Studio, I finalize results per item and include both success count and failure details in the response.

## Don't wrap everything in try/catch

Process each item individually instead of the entire batch.

```ts
const successes = [];
const failures = [];

for (const input of inputs) {
  try {
    const result = await generate(input);
    await saveHistory(result);
    successes.push(result);
  } catch (error) {
    failures.push({
      sourceKey: input.sourceKey,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
```

If generation succeeds, save the history immediately. Saving everything after the loop means a late exception loses earlier results.

## Return stable identifiers

Failure results include `sourceKey` instead of array index.

```json
{
  "succeeded": 3,
  "failures": [
    {
      "sourceKey": "history:image-42",
      "error": "rate limited"
    }
  ]
}
```

The UI can identify which asset failed even after sorting or re-fetching. Retries can target individual `sourceKey` values.

## Separate saved from adopted

Saving an image file is different from deciding to adopt it for the game. Assets have states like `review`, `adopted`, `rejected` and an `assetPath`.

Saved generation results start as review candidates. After human confirmation and adoption, they reconcile with the game manifest. Without this distinction, download success would be treated as adoption.

## Only treat zero successes as request failure

Return results if at least one item succeeded. Return an error response only when all items failed. The client can add successes to the list and notify about failures.

Adopting partial success requires making the process closer to idempotent. Decide upfront how to handle re-saving the same `sourceKey`, whether to reuse external job IDs, and whether to allow duplicate file names.

Returning batch completion as only true or false makes the retry unit the entire batch. Finalizing successful items immediately and returning failures in an identifiable form lets you narrow the retry scope even when processing involves external APIs.
