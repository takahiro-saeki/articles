---
title: "Cancelling timers with AbortController: seven cases including cleanup"
published: false
tags: javascript, node, async, testing
canonical_url: null
---

`AbortController` is not limited to fetch. Calling `abort()` does not stop an arbitrary Promise, though. The operation must accept the signal and implement both stopping its wait and rejecting its Promise.

A small timer function was tested with cancellation before it started, while it was waiting, and after completion. The check covered not only rejection, but also whether abort listeners remained after the operation ended.

## Implement a delay that handles cancellation

Save this function as `cancellable-delay.mjs`. It is an implementation for this experiment, not code already integrated into an existing application.

```js
export function delay(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    const cleanup = () => signal.removeEventListener('abort', onAbort);
    const onAbort = () => {
      clearTimeout(timer);
      cleanup();
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      cleanup();
      resolve('finished');
    }, ms);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}
```

If the signal is already aborted, the function immediately rejects with its reason. Otherwise it registers a timer and an abort listener. On cancellation, it clears the timer, removes the listener, and rejects.

Normal completion also removes the listener. `{ once: true }` removes a listener after an abort event occurs; it does not replace cleanup for an operation that finishes normally.

The [DOM requirements for abortable APIs](https://dom.spec.whatwg.org/#using-abortcontroller-and-abortsignal-objects-in-apis) describe checking whether the signal is already aborted when starting and rejecting an unfinished operation with the abort reason. This function follows that flow.

## Stop multiple timers with the same signal

Place this executable example in the same directory:

```js
import { delay } from './cancellable-delay.mjs';

const controller = new AbortController();
const group = Promise.allSettled([
  delay(10000, controller.signal),
  delay(10000, controller.signal),
]);
const reason = new Error('screen closed');
controller.abort(reason);
const results = await group;
console.log(results.map(result => result.status));
console.log(results.every(result => result.reason === reason));
```

It printed `[ 'rejected', 'rejected' ]` followed by `true`. Both timers received the same signal and rejected with the same `Error` object. `Promise.allSettled` collected their outcomes; the abort handling inside `delay` stopped the timers.

The example creates the aggregate Promise before cancelling. This establishes a path to receive rejection outcomes before calling abort.

## Verify cleanup under 7 conditions

The tests ran on September 11, 2026, with macOS arm64 and Node.js 24.15.0. Node.js `getEventListeners` was used to inspect abort listener counts for the custom function.

| Condition | Observation |
| --- | --- |
| Abort before calling the function | Rejected with the same reason; 0 remaining abort listeners |
| Abort 2 timers sharing a signal | Both rejected; registered listeners went from 2 to 0 |
| Abort after normal completion | Still fulfilled; listener count was already 0 at completion |
| Include an operation without a signal | Only the cooperative operation rejected; the other completed |
| Abort a Node.js Promise-based timer | Rejected with AbortError; its `cause` was the supplied reason |
| Combine a manual signal and timeout with `AbortSignal.any` | Custom delay rejected with the manual abort reason |
| Let only the timeout fire | Custom delay rejected with TimeoutError |

The waiting cases registered 10000-millisecond timers before cancellation. Normal completion used 0 milliseconds; the firing timeout used 1 millisecond. These values drive state transitions. They are not measurements of execution time or cancellation latency.

The custom delay cleared its timer after rejection, and the Node.js process exited. Together with the listener checks, this confirmed that the implementation did not merely reject its Promise while leaving a long-running timer behind.

## APIs can expose cancellation reasons differently

The custom delay passes `signal.reason` directly to reject. In contrast, the `node:timers/promises` case supplied an `Error` as the reason but received a separate `AbortError` whose `cause` was the original reason.

Node.js [Promise-based timers](https://nodejs.org/download/release/v24.15.0/docs/api/timers.html#cancelling-timers) already support AbortSignal cancellation. They are an option for waits specific to Node. The custom implementation here makes the operation's cleanup responsibilities visible.

`AbortSignal.any` combines signals and takes the reason from the first signal that aborts. Check support in the target runtime for it and `AbortSignal.timeout`. Both are covered in the [Node.js AbortSignal reference](https://nodejs.org/download/release/v24.15.0/docs/api/globals.html#class-abortsignal).

## An operation without the signal continues

One of the 7 conditions paired a cancellation-aware delay with a Promise-based timer that received no signal. After abort, the first rejected, but the second's completion flag became `true`. Having a controller available in a shared variable does not enroll an operation in cancellation.

This experiment also did not test forcibly stopping a synchronous loop that occupies the CPU. Nor does it establish that cancelling a network request rolls back a remote server's work or previously stored data. It verifies cooperative signal handling for waits in the same process.

The [custom function](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/language-batch08/cancellable-delay.mjs), [test code](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/language-batch08/run-runtime.mjs), and [results for the 7 conditions](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/production/2026-09/batch-08/abort-results.json) are available. When adding cancellation, check the initial aborted state, resource release on cancellation, and listener removal on normal completion as parts of the same operation.
