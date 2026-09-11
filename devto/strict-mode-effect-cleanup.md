---
title: "When Strict Mode reruns Effects: inspect subscription setup and cleanup"
published: false
tags: react, javascript, testing
canonical_url: null
---

When Strict Mode logs an Effect setup twice, check whether cleanup ran between the setups and how many subscriptions remain. Reducing the setup count to one does not establish that cleanup works.

A small subscription was compared in React 19.3.0 development and production builds. Initial behavior also differed between wrapping the root in Strict Mode and wrapping only part of the tree.

## Count registration and removal without external communication

The test subscription target is a Set. Setup registers a handler, and a local button invokes all registered handlers. There are no network connections or notification services.

```jsx
function Subscription({ room, cleanup }) {
  useEffect(() => {
    const handler = () => trace.events.push(`message:${room}`);
    trace.active.add(handler);
    trace.events.push(`setup:${room}`);
    if (cleanup) {
      return () => {
        trace.active.delete(handler);
        trace.events.push(`cleanup:${room}`);
      };
    }
  }, [room, cleanup]);
  return <output id="room">{room}</output>;
}
```

`trace.active` contains registered handlers, and `trace.events` records their order. The normal version uses `cleanup: true`; the deliberately incomplete comparison uses `false`. The room can change from A to B, and the root is unmounted at the end.

Separate bundles were built with development and production values for `process.env.NODE_ENV`. In the root-wide condition, `<StrictMode>` wraps the element rendered by `createRoot`. In the partial condition, it wraps only `Subscription` beneath a parent outside Strict Mode.

## Placement changed initial setup and cleanup

| Build and placement | Initial setups | Initial cleanups | Handlers remaining after initial processing |
| --- | --- | --- | --- |
| Development, root Strict Mode, with cleanup | 2 | 1 | 1 |
| Development, no Strict Mode, with cleanup | 1 | 0 | 1 |
| Development, child-only Strict Mode, with cleanup | 1 | 0 | 1 |
| Production, root Strict Mode, with cleanup | 1 | 0 | 1 |
| Development, root Strict Mode, without cleanup | 2 | 0 | 2 |

The normal development root logged `setup:A → cleanup:A → setup:A` during initial processing. It removed the earlier subscription before setting it up again.

The [official Strict Mode documentation](https://react.dev/reference/react/StrictMode) distinguishes the extra development setup/cleanup cycle from the condition where initial Effects are not rerun because Strict Mode does not wrap the root. Check where Strict Mode is placed before interpreting repeated Effect logs.

The table counts Effect work. It does not establish component-function invocation counts or DOM painting counts.

## Omitting cleanup accumulated handlers

Pressing the local notification button once after initial setup logged one `message:A` with cleanup and 2 without it. The next step changed the room to B.

| Development root condition | After initial registration | After changing room | After unmount |
| --- | --- | --- | --- |
| With cleanup | 1 | 1 | 0 |
| Without cleanup | 2 | 3 | 3 |

The normal version logged `cleanup:A → setup:B` on the room change and `cleanup:B` on unmount. Without cleanup, the A handlers remained while a B handler was added. They stayed in the Set after unmount too.

The comparison shows what remains when the implementation omits its removal step. Each case discards its Set; the incomplete version was not integrated into an application.

## Check the matching teardown before limiting calls

For this example, the fix is to remove the same handler that setup registered. A room change removes the old room's subscription before registering the new one. The [useEffect reference](https://react.dev/reference/react/useEffect) describes cleanup with previous values followed by setup with the new values when dependencies change.

This experiment does not apply the extra-execution scenario to API writes, payments, or email delivery. Its scope is a subscription with matching registration and removal. If real logs differ, investigate actual unmounts and remounts or development-tool updates as well as Strict Mode placement.

The tests ran on September 11, 2026, with React and React DOM 19.3.0, Node.js 24.15.0, esbuild 0.28.2, macOS arm64, and Headless Chrome 152 and no React Compiler. The [fixture code](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/react-batch09/effects.jsx) and [results for the 5 conditions](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/production/2026-09/batch-09/browser-results.json) include room changes and unmounts as well as initial processing.
