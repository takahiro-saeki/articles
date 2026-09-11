---
title: "Comparing Promise.all, allSettled, any, and race when failure arrives first"
tags: javascript, typescript, node, testing
canonical_url:
published: false
---

When work can partially fail, decide which event should settle the aggregate Promise. Replacing `Promise.all` with `allSettled` does not change how many operations start or how they can be cancelled.

The comparison passes A, B, and C in that order, then rejects B, fulfills C, and finally fulfills A.

| Method | Immediately after B fails | Result observed after all inputs settle |
| --- | --- | --- |
| `all` | Rejected | B's error |
| `allSettled` | Pending | An array: A fulfilled, B rejected, C fulfilled |
| `any` | Pending | C's value, the first fulfillment |
| `race` | Rejected | B's error, the first settlement |

The test environment was Node.js `v24.15.0` on September 11, 2026. This checks a controlled settlement order, not wall-clock speed.

## Specify completion order without timers

`Promise.withResolvers()` returns a Promise together with externally callable `resolve` and `reject` functions. The core of the comparison is:

```js
const a = Promise.withResolvers();
const b = Promise.withResolvers();
const c = Promise.withResolvers();

const result = Promise.allSettled([a.promise, b.promise, c.promise]);
b.reject(new Error("B failed"));
c.resolve("C result");
a.resolve("A result");

console.log(await result);
```

There is no real network request here. The result follows the input order A, B, C, rather than the completion order B, C, A. A batch can use that ordering to associate each result with its original input.

The [complete reproduction](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/promise-combinators.mjs) runs the four methods separately and asserts both their state after B's failure and their final result.

```bash
node experiments/article-stock-2026-09/promise-combinators.mjs
```

The settlement rules were also checked against the [ECMAScript Promise specification](https://tc39.es/ecma262/multipage/control-abstraction-objects.html#sec-promise.all). This comparison supplies an array of ordinary Promises; exceptions thrown by the input iterator itself are a separate case.

## The remaining inputs still exist after rejection

After `all` and `race` rejected with B's error, the experiment could still fulfill C and A. Rejection of the aggregate did not cancel the input Promises.

In a notification batch, some requests might already have been sent. Resending every item simply because execution reached `all`'s catch handler could duplicate successful sends. Aggregating results and deciding how to stop or retry individual operations need separate policies.

The same applies to `race`. If a timeout Promise settles first, the competing network operation is not automatically stopped. Cancellation requires a mechanism supported by the operation itself. Implementing cancellable fetches or timers is outside this experiment.

## A synchronous throw can happen before allSettled receives anything

This version throws while constructing the array:

```js
const jobs = [
  () => 1,
  () => { throw new Error("sync failure"); },
  () => 3,
];

await Promise.allSettled(jobs.map(job => job()));
```

Because `map` never finishes, execution never reaches the call to `allSettled`. To collect failures from every job as results, move each invocation into a Promise:

```js
const results = await Promise.allSettled(
  jobs.map(job => Promise.resolve().then(job)),
);
```

The resulting statuses were `fulfilled`, `rejected`, and `fulfilled`. This is not special handling of synchronous exceptions by `allSettled`: the exception inside `then` becomes rejection of that input Promise.

It still does not impose a concurrency limit. It only moves function execution into Promises. If a large set of jobs must not start together, choose a worker count or queue separately.

## Include empty input in the caller's contract

For an empty array, `all` and `allSettled` fulfill with an empty array. `any` rejects with an `AggregateError` whose `errors` array is empty, and `race` stays pending. The same script checks these cases.

For example, passing an empty list of candidate servers straight to `race` will not produce a result. Decide in advance whether zero inputs mean success or an invalid request.

In this comparison, `allSettled` collects every outcome; `all` requires every input to succeed; `any` needs one success; and `race` observes the first settlement regardless of success or failure. None of those choices alone determines persistence or cancellation behavior.
