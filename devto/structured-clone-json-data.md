---
title: "Comparing structuredClone and JSON copies through values and reference identity"
published: false
tags: javascript, node, testing
canonical_url: null
---

Copying an object with `JSON.parse(JSON.stringify(value))` can succeed while changing what the data means. In this experiment, the changes went beyond turning a Date into a string: Map contents and relationships between references changed too.

The two approaches were compared on Node.js 24.15.0. Specify which values need copying and which reference relationships the copy must retain.

## Check values and references together

This example uses synthetic data resembling an article draft, not real user records. The experiment ran on September 11, 2026. The JSON roundtrip used no replacer, reviver, or custom `toJSON` method.

```js
const row = { id: 'draft-1', status: 'ready' };
const source = {
  createdAt: new Date('2026-09-11T00:00:00.000Z'),
  counts: new Map([['ready', 2]]),
  memo: undefined,
  slots: [undefined],
  left: row,
  right: row,
};
const cloned = structuredClone(source);
const jsonCopy = JSON.parse(JSON.stringify(source));
console.log(cloned.createdAt instanceof Date, typeof jsonCopy.createdAt);
console.log(cloned.counts.get('ready'), jsonCopy.counts);
console.log(Object.hasOwn(cloned, 'memo'), Object.hasOwn(jsonCopy, 'memo'));
console.log(cloned.slots[0], jsonCopy.slots[0]);
console.log(cloned.left === cloned.right, jsonCopy.left === jsonCopy.right);
```

It printed:

```text
true string
2 {}
true false
undefined null
true false
```

The structured clone's Date and Map remained usable as those types. The JSON copy contained a string for the Date and an empty object for the Map. Its `memo: undefined` property disappeared, while `undefined` inside the array became `null`.

The final line matters for some copying requirements. Originally, `left` and `right` referenced the same `row`. The structured clone kept them pointing at the same copied object. The JSON roundtrip made separate objects. Neither approach retained a reference to the original `row`. The [HTML structured serialization specification](https://html.spec.whatwg.org/multipage/structured-data.html#structuredserializeinternal) defines bookkeeping that avoids processing an object twice and preserves cycles and reference identity.

## Success alone does not establish the intended copy semantics

The experiment tested 12 separate inputs. These are representative results:

| Input | structuredClone | JSON roundtrip |
| --- | --- | --- |
| Date | Date | ISO-formatted string |
| Map | Map containing entries | Empty object |
| undefined in an object | Key and value retained | Key removed |
| undefined in an array | undefined element | null element |
| NaN, Infinity, -0 | Properties of each value retained | null, null, 0 |
| Two properties referencing the same child | Copied properties share a child | Copied properties have separate children |
| Circular reference | Cycle retained in the copy | TypeError |
| Object containing BigInt | bigint value retained | TypeError |
| Object with a function property | DataCloneError | Function key removed |

The JSON cases that removed a function or undefined property did not throw. A test that checks only for exceptions misses those changes. The [ECMAScript JSON specification](https://tc39.es/ecma262/multipage/structured-data.html#sec-json.stringify) also distinguishes serialization by value type and by its position in an object or array.

The comparison used `instanceof`, `Object.hasOwn`, `Object.is`, and reference `===` checks. Comparing only JSON strings cannot test properties that serialization itself removes.

## structuredClone does not fully duplicate class instances

The remaining 3 cases examined a class, frozen state, and a getter.

Copying a custom `Draft` instance retained its ordinary `title` data property. However, `instanceof Draft` was `false`, and the prototype's `label()` method was absent. The JSON roundtrip produced the same observations.

Copies made from `Object.freeze({ count: 1 })` were not frozen under either method, and `count` was writable. For an object with a getter, both methods invoked it while reading the value. The copy contained an ordinary property with the value `2`. Copying once with each method invoked the getter a total of 2 times.

These results support using class-specific construction when the goal includes reproducing a domain object's behavior. Copying this class did not produce another instance with the same callable methods.

## Transfer does not leave the original buffer available

```js
const bytes = new Uint8Array([1, 2, 3]);
const moved = structuredClone(bytes, { transfer: [bytes.buffer] });
console.log(bytes.byteLength, [...moved]);
```

This printed `0 [ 1, 2, 3 ]`. The destination retained the values, while the original ArrayBuffer was detached. If another operation still needs the source buffer, this cannot be treated as an ordinary copy. [Node.js structuredClone](https://nodejs.org/download/release/v24.15.0/docs/api/globals.html#structuredclonevalue-options) provides the WHATWG API with this transfer option.

The experiment measured differences in values, references, and exceptions. It did not compare speed, memory use for large inputs, or browser-specific objects such as DOM elements. A protocol that exchanges JSON still needs conversion to that format. This experiment helps identify which changes are acceptable when reusing a JSON roundtrip for an in-memory copy.

The [execution script](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/language-batch08/run-runtime.mjs) and [results for the 12 cases and transfer](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/production/2026-09/batch-08/clone-results.json) record the shape of each copy as well as whether copying succeeded.
