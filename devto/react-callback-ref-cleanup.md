---
title: "Testing callback ref cleanup on the same DOM node and in TypeScript"
published: false
tags: react, typescript, javascript, testing
canonical_url: null
---

A React callback ref can return a cleanup function as well as receive a DOM node. This capability, added in React 19, was tested through ResizeObserver registration and disconnection.

Unmounting is only part of the behavior. Even when the same DOM node remained, changing the callback reference ran the previous cleanup and the next registration.

## Return disconnection from the callback that creates the observer

This function creates a callback ref and records its activity. With `legacy: false`, it returns cleanup. With `true`, it disconnects when called with null.

```jsx
function makeTrackedRef(legacy) {
  let observer;
  function disconnect() {
    observer.disconnect();
    trace.active.delete(observer);
    trace.events.push('cleanup');
  }
  return node => {
    if (node === null) {
      trace.events.push('null');
      if (observer) disconnect();
      return;
    }
    observer = new ResizeObserver(() => {});
    observer.observe(node);
    trace.active.add(observer);
    trace.events.push('attach');
    if (!legacy) return disconnect;
  };
}
```

The fixture creates a real browser ResizeObserver and observes the node. `trace.active` tracks observers whose disconnection has not been recorded. Resize notification counts are not part of this comparison.

The test compares preserving a callback with creating a new one on every render:

```jsx
export function RefExperiment({ stable, legacy }) {
  const [tick, setTick] = useState(0);
  const stableRef = useMemo(() => makeTrackedRef(legacy), [legacy]);
  const ref = stable ? stableRef : makeTrackedRef(legacy);
  return <section>
    <button id="rerender" onClick={() => setTick(previous => previous + 1)}>Render {tick}</button>
    <div id="observed" ref={ref}>Observed node</div>
  </section>;
}
```

Clicking the button rerenders the parent while the target `div` remains the same node. The root is then unmounted to verify cleanup.

## A different callback triggers cleanup on the same node

| Build and callback construction | Initial log | Log added by rerender | Log added by unmount |
| --- | --- | --- | --- |
| Production, same callback, returns cleanup | attach | None | cleanup |
| Production, new callback, returns cleanup | attach | cleanup → attach | cleanup |
| Production, same callback, cleans up on null | attach | None | null → cleanup |
| Development root Strict Mode, same callback, returns cleanup | attach → cleanup → attach | None | cleanup |
| Development root Strict Mode, new callback, returns cleanup | attach → cleanup → attach | cleanup → attach | cleanup |
| Development root Strict Mode, same callback, cleans up on null | attach → null → cleanup → attach | None | null → cleanup |

All 6 conditions had one tracked observer after initial processing and after rerender, then 0 after unmount. Even the version creating new callbacks paired setup with cleanup, so observers did not accumulate in this implementation.

The [callback ref reference](https://react.dev/reference/react-dom/components/common#ref-callback) distinguishes returned cleanup, cleanup and reattachment when callbacks change, and the extra development cycle. No null call appeared in the returned-cleanup version's logs. Do not expect a second copy of the same cleanup through a null callback.

Direct comparison of node references before and after rerender confirmed that the DOM node stayed the same. Callback activity and DOM replacement are separate observations.

## An implicit value return can fail type checking

Type behavior was also checked with TypeScript 7.0.2, `@types/react` 19.3.0, strict checking, and `react-jsx`.

```tsx
import React from 'react';
const nodes = new Map<string, HTMLDivElement | null>();
export const view = <div ref={node => nodes.set('preview', node)} />;
```

`Map.set` returns the Map, so this callback did not satisfy the required void-or-cleanup return type and produced TS2322. A cleanup written as `() => nodes.delete('preview')` also produced TS2322 because it returns a boolean.

The version using a block and returning no value from cleanup passed:

```tsx
import React from 'react';
const nodes = new Map<string, HTMLDivElement>();
export const view = <div ref={node => {
  if (!node) return;
  nodes.set('preview', node);
  return () => { nodes.delete('preview'); };
}} />;
```

This type comparison corresponds to the change described in the [React 19 upgrade guide](https://react.dev/blog/2024/04/25/react-19-upgrade-guide#ref-cleanups-required). When the operation is storing a node in a Map, avoid forwarding the Map operation's return value as the ref callback result.

## Separate cleanup behavior from state-update loops

An existing article examined a ref callback that repeatedly updated state in an image preview. This experiment leaves state updates out of the observer callback and compares callback identity with cleanup timing. It does not establish that returning cleanup fixes arbitrary state-update loops.

The tests ran on September 11, 2026, with React and React DOM 19.3.0, Node.js 24.15.0, esbuild 0.28.2, macOS arm64, and Headless Chrome 152 and no React Compiler. The production cases also had a Strict Mode wrapper, but did not run the extra development cycle. Observer counts come from fixture registration and disconnection records, not measurements of the browser's internal resource usage.

The [fixture code](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/react-batch09/refs.jsx), [logs for the 6 conditions](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/production/2026-09/batch-09/browser-results.json), and [3 type-checking cases](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/production/2026-09/batch-09/ref-type-results.json) separate changes to the DOM node from changes to the callback reference.
