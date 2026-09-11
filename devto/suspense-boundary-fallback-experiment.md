---
title: "What stays visible when a Suspense boundary moves: five loading cases"
published: false
description: "A production React experiment separates initial loading, urgent updates, transitions, and boundary resets."
tags: [react, typescript, frontend, webdev]
canonical_url: "https://zenn.dev/hirodeath/articles/suspense-boundary-fallback-experiment"
---

A search request makes the heading and input disappear along with the results. Moving `Suspense` around the results can change that behavior. Keeping previously displayed results also depends on how the update is scheduled.

This experiment checks the DOM in five configurations of boundary placement, transitions, and keys. **Put controls that must remain available outside the boundary, then decide whether a refresh of the same content should retain its previous result**.

## Hold loading still instead of varying network speed

The experiment ran on September 11, 2026, using a production build of React / React DOM 19.2.5, esbuild 0.27.4, and Node.js 24.15.0. Playwright CLI 0.1.19 launched HeadlessChrome 152.0.0.0, as reported in User-Agent. React Compiler was not used.

A manually resolved Promise replaces the search API. Each Promise is created once outside rendering, and the same instance is passed until it resolves.

```tsx
type Gate = { version: number; promise: Promise<string>; resolve: () => void };
function makeGate(version: number): Gate {
  let resolve!: (value: string) => void;
  const promise = new Promise<string>(done => { resolve = done; });
  return { version, promise, resolve: () => resolve(`Result ${version}`) };
}
function Result({ gate }: { gate: Gate }) {
  return <p id="result">{use(gate.promise)}</p>;
}
```

`use` suspends the component while the Promise is pending. The [official use documentation](https://react.dev/reference/react/use) also describes the requirement to reuse a Promise. This example does not create a new `use(fetch(...))` call on every render.

Every case follows the same procedure: inspect the DOM with the initial Promise pending, resolve it to display `Result 0`, enter `typed` into the input, update to another pending result, and inspect the DOM again. Finally, resolve the second Promise and check `Result 1`.

This avoids missing a fallback because a request happened to finish quickly. It does not measure real network requests, server streaming, browser paint, or the duration of a visual flash.

## A transition cannot retain a result that has never appeared

The broad boundary wraps the entire `Shell`, including the heading, input, and result. The narrow boundary wraps only the result inside `Shell`.

```tsx
function Shell({ children }: { children: React.ReactNode }) {
  return <section id="shell"><h1>Search workspace</h1><input id="query" defaultValue="draft" />{children}</section>;
}
```

While the initial Promise was pending, the broad boundary showed only its fallback. The narrow boundary showed the heading and input with the fallback below them. Configuring subsequent updates to use a transition did not change this initial difference.

There is no previous search result on the initial render. A transition therefore does not mean that loading UI will never appear. If already available instructions or controls disappear too, first consider placing them outside the boundary.

Suspension uses the fallback of the nearest ancestor boundary. The granularity discussed in the [official Suspense documentation](https://react.dev/reference/react/Suspense) concerns which content should appear together, rather than how many small components exist.

## Combine boundary placement with the update method

These are the observations after displaying `Result 0` and selecting a still-pending `Result 1`. A previous result counts as visible only when its text is actually displayed. Retained but hidden DOM does not count.

| Configuration | Heading and input | Fallback | Previous result | Pending indicator |
| --- | --- | --- | --- | --- |
| Broad boundary, urgent update | Hidden | Visible | Hidden | idle |
| Narrow boundary, urgent update | Visible | Visible | Hidden | idle |
| Broad boundary, transition | Visible | Hidden | Result 0 | pending |
| Narrow boundary, transition | Visible | Hidden | Result 0 | pending |
| Narrow boundary, transition, changed key | Visible | Visible | Hidden | idle |

Narrowing the boundary retained the input during an urgent update. The result still changed to a fallback. That can be appropriate when the previous result should disappear as soon as search criteria change.

A transition with a stable boundary retained the displayed screen even with the broad boundary. That does not erase the distinction between broad and narrow placement: initial loading still differs.

The experiment creates the Promise, then passes only the state update selecting that result to `startTransition`. The input is uncontrolled and is not part of the transition. The [useTransition documentation](https://react.dev/reference/react/useTransition) also states that transitions cannot control text input state.

## A changed key resets the assumption behind retaining content

The last configuration uses the result version as the key of the narrow `Suspense` boundary. Even during a transition, the new boundary displayed its fallback. Its pending indicator was already `idle` at that point. Consequently, `isPending` cannot answer whether every network request in an application has finished.

Filtering the same list might call for dimmed previous results and an updating indicator. Switching to another customer or document may make retaining old information misleading. Resetting the boundary with a key can be meaningful in that situation.

The input sits outside the changing key in this experiment. Its value remained `typed` after loading finished in every case. Even the broad boundary's urgent update did not erase that value. A temporary disappearance and an unmount that loses state need separate checks.

## Check these observations in the actual screen

The experiment verifies manually held Promises and DOM visibility. The implementation and runner are in the [experiment source](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/run-suspense-batch07.py). After resolution, every case displayed `Result 1`, had no fallback, and preserved the input value.

In an application, the data fetching library must also support Suspense. Wrapping an Effect-based fetch in a boundary does not give it the same behavior. Server streaming and router transitions need their own checks beyond this browser-only experiment.

Pause initial loading and subsequent fetching separately. Then inspect the input, results, and updating indicator. This distinguishes disappearing UI that boundary placement can address from the update behavior needed to retain an earlier result.
