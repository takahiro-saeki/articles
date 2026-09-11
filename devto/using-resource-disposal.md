---
title: "What JavaScript using disposes after returns and exceptions: nine checks"
published: false
tags: javascript, node, testing
canonical_url: null
---

`using` registers an object with a disposal method in a scope and calls cleanup when that scope ends. When several resources were registered, they were disposed in reverse acquisition order. An early return followed the same rule.

Nine conditions in Node.js covered disposal order, retained exceptions, and asynchronous waiting. Before using it, check which object supplies disposal and which scope exit triggers cleanup.

## Disposal finishes before the caller receives a return value

This code ran as an `.mjs` file in Node.js 24.15.0, without a transpiler or polyfill:

```js
const events = [];
function open(name) {
  events.push(`open:${name}`);
  return { [Symbol.dispose]() { events.push(`close:${name}`); } };
}
function work() {
  using first = open('A');
  using second = open('B');
  events.push('body');
  return 'done';
}
const value = work();
console.log(JSON.stringify({ value, events }));
```

The result contained `value: "done"`, with events `open:A → open:B → body → close:B → close:A`. Both disposals had finished when the caller received the return value.

`open` only returns a fixture object. The log records calls to `Symbol.dispose`; it is not a measurement of real files or connections. The [ECMAScript declaration and scope specification](https://tc39.es/ecma262/multipage/ecmascript-language-statements-and-declarations.html#sec-let-and-const-declarations) also describes disposing resources registered through using when scope processing finishes.

The comparison included failures as well as normal completion:

| Condition | Observed order or result |
| --- | --- |
| Acquire A and B, finish normally | Dispose B, then A |
| Acquire A and return | Dispose A before returning to the caller |
| Throw in the body | Dispose A before entering catch |
| Acquire A, then throw while acquiring B | Dispose registered A; no disposal call for B |
| Body and both A/B disposals throw | Attempt both disposals and retain errors through SuppressedError |
| Register A and B with await using | Finish B's asynchronous disposal before disposing A |
| Pass an asyncDispose-only value to using | TypeError; asynchronous disposal is not called |
| Pass null and undefined to using | Execute the body without disposal methods |
| Throw while using a temporary directory | Directory no longer exists after entering catch |

When acquiring B throws, using does not dispose B afterward. If the acquisition function allocated something before failing, that function needs to clean up its partial acquisition.

## Where does the body error go if cleanup fails too?

A deliberately failing disposer tested this case. The body threw `body failed`, B threw `close failed:B`, and A threw `close failed:A`.

The caught exception's `error.message` was `close failed:A`. The body failure was still retained:

| Reference | Recorded message |
| --- | --- |
| error.error.message | close failed:A |
| error.suppressed.error.message | close failed:B |
| error.suppressed.suppressed.message | body failed |

Both the outer and inner wrappers were `SuppressedError` objects. Cleanup continued after a disposal failed, with earlier errors retained in a related chain. The [explicit resource management design material](https://github.com/tc39/proposal-explicit-resource-management#the-suppressederror-error) explains this relationship.

Logging only the outer message can miss the body failure. The experiment followed both `error` and `suppressed` and checked each message.

## Use await using for asynchronous disposal

The asynchronous fixture recorded the start and end of `Symbol.asyncDispose` separately. Registering `await using a = ...` and `await using b = ...` produced `body → close start:B → close end:B → close start:A → close end:A → after work`.

The wait in this fixture was `Promise.resolve()`. It did not measure network or disk I/O duration. It did verify that A's disposal started after B's completed, and that the caller continued after both finished.

Passing an object with only `Symbol.asyncDispose` to using without await produced a TypeError. An asynchronously disposable value cannot simply be placed in an ordinary using declaration.

## Check a real Node.js temporary directory

The next example uses an actual temporary directory rather than only a logging object:

```js
import { existsSync, mkdtempDisposableSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let path;
try {
  using temporary = mkdtempDisposableSync(join(tmpdir(), 'article-using-example-'));
  path = temporary.path;
  writeFileSync(join(path, 'sample.txt'), 'fixture');
  console.log('inside:', existsSync(path));
  throw new Error('work failed');
} catch (error) {
  console.log('caught:', error.message);
}
console.log('after:', existsSync(path));
```

The output was `inside: true`, `caught: work failed`, and `after: false`. The directory, including `sample.txt`, was removed when the exception left the scope.

[Node.js 24.15.0's mkdtempDisposableSync](https://nodejs.org/download/release/v24.15.0/docs/api/fs.html#fsmkdtempdisposablesyncprefix-options) returns an object with a path and a disposal method for removal. This API was added in 24.4.0. An arbitrary path string does not acquire that deletion behavior merely by being used in a using declaration.

The tests ran on September 11, 2026, with Node.js 24.15.0 on macOS arm64. The [nine-condition fixture](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/using-resource-disposal.mjs) and [results](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/production/2026-09/batch-10/using-results.json) are available. Other Node versions, browsers, transformed code, and forced process termination were not tested. These results cover disposal when JavaScript can execute the scope-exit steps.
