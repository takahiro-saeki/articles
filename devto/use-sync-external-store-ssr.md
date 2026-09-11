---
title: "useSyncExternalStore: test snapshot identity and the initial SSR value"
published: false
tags: react, javascript, ssr, testing
canonical_url: null
---

An external store can notify its subscribers without changing the screen rendered through `useSyncExternalStore`. After the same snapshot object was mutated in this experiment, the screen still displayed `0` following the notification.

The Hook needs a subscription notification and a snapshot that represents the change. With SSR, the initial client read must also receive the value used to generate the server HTML.

## The notification arrived with the same snapshot reference

This test store includes both replacement and a deliberately incorrect mutation for comparison. The `mutate` method is not a recommended application pattern.

```js
export function createCounterStore(initial) {
  let snapshot = initial;
  const listeners = new Set();
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    replace(count) {
      snapshot = { count };
      for (const listener of listeners) listener();
    },
    mutate(count) {
      snapshot.count = count;
      for (const listener of listeners) listener();
    },
    listenerCount: () => listeners.size,
  };
}
```

`replace` creates a new object. `mutate` changes only `count` on the existing object. Both call the registered listeners.

The screen reads `count` from `useSyncExternalStore(store.subscribe, store.getSnapshot)`.

| Operation | Count in the store | Count on screen | Recorded values passed through the display component |
| --- | --- | --- | --- |
| Initial | 0 | 0 | 0 |
| Mutate the same snapshot and notify | 1 | 0 | No additional invocation |
| Replace with a new snapshot and notify | 2 | 2 | 2 added |

Checking only whether a notification was sent misses this difference. The value returned by `getSnapshot` must represent the change when compared with `Object.is`. The [official reference](https://react.dev/reference/react/useSyncExternalStore) describes the contract: return the same snapshot while data is unchanged, and a new immutable snapshot when it changes.

The test observed the mutation without an unrelated parent-state update or other rerender. It did not check what the display would show after a rerender triggered elsewhere.

Returning a new object on every read violates the contract too. The documentation describes that pattern as causing an update loop, but this experiment did not execute that loop. It checks a store that reuses a snapshot until the next change.

## Include unsubscription in the store contract

`subscribe` returns a function that removes the listener as well as registering it. The experiment recorded one subscription after mount and 0 after unmount.

The same store-provided `subscribe` function is reused. This does not measure resubscription caused by creating a new function on every render or performance with many subscribers.

## SSR needs a matching initial snapshot as well as a current value

The server generated this HTML with `renderToString`:

```html
<output id="store-count">0</output>
```

The client store intentionally starts with a newer current value of `1`. The server's initial `{ count: 0 }` is passed through `window.__BOOTSTRAP__` and read during hydration.

```jsx
import React from 'react';
import { hydrateRoot } from 'react-dom/client';
import { createCounterStore, StoreCounter } from './external-store.mjs';
const bootstrap = window.__BOOTSTRAP__;
const store = createCounterStore({ count: 1 });
const record = { serverSnapshots: [], renders: [], errors: [] };
function getServerSnapshot() {
  record.serverSnapshots.push(bootstrap.count);
  return bootstrap;
}
const root = hydrateRoot(document.getElementById('root'),
  <StoreCounter store={store} getServerSnapshot={getServerSnapshot} rendered={value => record.renders.push(value)} />,
  { onRecoverableError(error) { record.errors.push(error.message); } });
window.readHydration = () => ({ ...record, count: document.getElementById('store-count')?.textContent, subscribers: store.listenerCount() });
window.unmountHydration = () => root.unmount();
```

`record` and `rendered` are instrumentation. They record snapshot reads and component invocations, while `onRecoverableError` captures mismatches. The HTML and bootstrap data contain fixed numbers only; this is not an example of embedding user data.

| Initial value passed to the client | Sequence of count values read by the component | Hydration mismatch |
| --- | --- | --- |
| 0, matching the server | 0 → 1 | None |
| 2, differing from the server | 2 → 1 | Present |

With the matching bootstrap, the component first read the server's value and then moved to the client store's current value. Both cases eventually displayed `1`, so inspecting only the final display would miss the mismatch. These records capture component invocations, not the number of frames for which `0` was visible.

Omitting `getServerSnapshot` and rendering the same component through `renderToString` threw an error requiring the initial snapshot. The [SSR documentation](https://react.dev/reference/react/useSyncExternalStore#adding-support-for-server-rendering) requires the same data during server rendering and hydration.

## The Hook does not replace the storage implementation

In this example, `createCounterStore` stores the value. The Hook connects its subscription and snapshot to React. The experiment does not move all application-local state into an external store.

The tests ran on September 11, 2026, with React and React DOM 19.3.0, Node.js 24.15.0, esbuild 0.28.2, macOS arm64, and Headless Chrome 152. Notification behavior used a production build; hydration used a development build. Neither used Strict Mode or React Compiler. Server rendering used Node.js `renderToString`. Tearing during concurrent rendering and streaming SSR were outside the test scope.

The [store and display component](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/react-batch09/external-store.mjs), [SSR input](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/react-batch09/render-ssr.mjs), and [browser results](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/production/2026-09/batch-09/browser-results.json) let you inspect notifications, snapshot references, and server initial values separately.
