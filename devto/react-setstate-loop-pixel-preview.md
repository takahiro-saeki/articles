---
devto_id: 4318448
title: The Callback Ref That Trapped My React Image Preview in an Infinite Render Loop
tags: devchallenge, bugsmash, react, typescript
published: true
---

_This article is an English translation of the original Japanese article._

*This is a submission for [DEV's Summer Bug Smash: Smash Stories](https://dev.to/bugsmash) powered by [Sentry](https://sentry.io/).*

I hit `Maximum update depth exceeded` in the pixel image preview. The culprit was not a `useEffect` dependency array, but a cycle between a ref callback that handles cached images and `setState` inside `onLoad`.

## The cycle that was happening

I store the natural size of the image in state and use that value to determine display scale.

```tsx
<PixelImg
  src={src}
  onLoad={(event) => {
    const img = event.currentTarget;
    setDims({ w: img.naturalWidth, h: img.naturalHeight });
  }}
/>
```

`PixelImg` had a fallback for cached images where the normal `onLoad` event might not fire.

```tsx
ref={(node) => {
  if (node && onLoad && node.complete && node.naturalWidth > 0) {
    onLoad({ currentTarget: node } as SyntheticEvent<HTMLImageElement>);
  }
}}
```

The ref callback invoked `onLoad`, `setDims` created a new object, and after re-rendering the ref callback ran again. State updates continued even when the dimensions were identical.

The confusing part was that the component did not contain the usual infinite-loop suspect: an effect with an unstable dependency. The stack trace pointed at state updates, but the trigger lived inside a callback ref that looked like DOM setup code.

## Limit fallback to once per URL

`PixelImg` records the `currentSrc` it has already handled in a ref.

```tsx
const firedFor = useRef<string | null>(null);

ref={(node) => {
  if (
    node &&
    onLoad &&
    node.complete &&
    node.naturalWidth > 0 &&
    firedFor.current !== node.currentSrc
  ) {
    firedFor.current = node.currentSrc;
    onLoad({ currentTarget: node } as SyntheticEvent<HTMLImageElement>);
  }
}}
```

It fires again when the image URL changes, but stops on re-renders of the same URL.

## Don't change state if dimensions are the same

I added a guard on the receiving side as well.

```tsx
setDims((previous) =>
  previous &&
  previous.w === img.naturalWidth &&
  previous.h === img.naturalHeight
    ? previous
    : { w: img.naturalWidth, h: img.naturalHeight },
);
```

When values are identical, returning the previous reference lets React skip the re-render. Stopping the cycle at both the source and the update site makes the code more resilient if either implementation changes later.

## Before and after

Before the fix, opening a cached image could immediately throw `Maximum update depth exceeded` and make the preview unusable. Freshly downloaded images did not always trigger the same path, so the failure appeared inconsistent.

After the fix:

- Each image URL can trigger the cached-image fallback once.
- Identical dimensions preserve the existing state reference.
- Changing to a different image still recalculates its natural size.
- Both cached and uncached image paths remain supported.

## Why I used two guards

Either guard can stop the current loop, but they protect different boundaries. `firedFor` makes the event source idempotent per resource. The functional state update makes the receiver idempotent per value.

Keeping both means a future refactor of the image wrapper cannot silently reintroduce the same rendering loop, and another caller that sends duplicate load events does not force unnecessary renders.

Infinite loops around image loading are not limited to `useEffect`. Callback refs are also in scope. Refs receive DOM nodes, but changing state inside them pulls you into the render cycle. Especially when manually firing events based on `complete`, you need to track how many times the same resource has triggered.

My main lesson was to trace the entire render feedback path rather than search only for effects. Any callback that runs because React attached or updated a DOM node can become part of a state-update cycle.
