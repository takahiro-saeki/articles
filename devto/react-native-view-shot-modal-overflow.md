---
devto_id: 4318459
title: Why My React Native ScrollView Would Not Scroll Inside a Share Preview Modal
tags: devchallenge, bugsmash, reactnative, expo
published: true
---

This article is an English translation of the original Japanese article.

*This is a submission for [DEV's Summer Bug Smash: Smash Stories](https://dev.to/bugsmash) powered by [Sentry](https://sentry.io/).*

In a modal for converting and sharing monthly schedules as an image, the share button was pushed off screen only for months with many events. The preview was in a `ScrollView`, but it would not scroll.

The problem was not the image conversion, but specifying `flex: 1` on a `ScrollView` inside a modal where the height was not fixed.

## Why the symptom was misleading

The preview scrolled correctly for short months because its content already fit. It failed only when enough schedule rows made the preview taller than the device. Since the component was a `ScrollView`, the first suspects were gesture handling and scroll configuration.

The real issue was one level higher: no ancestor gave the scroll container a definite viewport to scroll within.

## Layout Where the Problem Occurred

The outer sheet had `maxHeight: "85%"`, and the inner preview had `flex: 1`.

```tsx
<View style={styles.sheet}>
  <Header />
  <ScrollView style={styles.preview}>
    <ShareImagePreview />
  </ScrollView>
  <ShareButton />
</View>
```

```ts
const styles = StyleSheet.create({
  sheet: { maxHeight: "85%" },
  preview: { flex: 1, minHeight: 160 },
});
```

The outer container has a content-dependent height, with only an upper limit specified as a percentage. Inside, the `ScrollView` could not determine the remaining available height, so it rendered at the full height of its content. As a result, the sheet itself extended off screen.

## Creating a Fixed Value from Screen Height

I retrieved the screen height with `useWindowDimensions` and passed a point value `maxHeight` to the preview.

```tsx
const { height: windowHeight } = useWindowDimensions();
const previewMaxHeight = Math.max(160, windowHeight * 0.85 - 320);

<ScrollView
  style={[styles.preview, { maxHeight: previewMaxHeight }]}
  contentContainerStyle={styles.previewContent}
>
  <ShareImagePreview />
</ScrollView>
```

`320` is the area used for the header, tabs, share button, and margins. It is not a strict design token, but on this screen I treat it as the value to subtract for the fixed parts inside the sheet. To avoid the preview disappearing on small devices, I set the lower limit to `160`.

```ts
preview: {
  minHeight: 160,
  borderWidth: 1,
  borderRadius: 10,
}
```

## Separating Capture Target from Display Area

When creating a long image with `react-native-view-shot`, the preview size on screen and the full image size to export are not necessarily the same. What I limited this time was the viewing area on the modal. It was not a change to trim the shared View content.

I confirmed the following three points:

- For months with few events, margins do not become unnaturally wide
- For months with many events, the preview can be scrolled
- On small devices, the share button remains reachable

## The impact of the fix

The modal now keeps its controls reachable across both content length and screen size. Long schedule previews scroll inside a bounded viewing area, while the exported image still contains the complete schedule rather than a cropped viewport.

This separation also clarified two responsibilities that had been mixed together:

- The modal owns the available on-screen height.
- The capture target owns the full shareable content size.

## What I learned

When a `ScrollView` does not scroll, I first want to suspect the scroll settings. However, if there is no fixed height anywhere in the parent-child hierarchy, it is calculated as a large View that does not need scrolling. If percentage specifications and `flex: 1` overlap inside a modal, providing a fixed `height` or `maxHeight` once makes it easier to isolate the issue.

A scrollable component needs both overflowing content and a constrained viewport. Checking only the `ScrollView` props missed half of that contract. Tracing the height calculation from the modal down to the preview exposed the bug much faster.

## References

- [React Native: useWindowDimensions](https://reactnative.dev/docs/usewindowdimensions)
- [React Native: ScrollView](https://reactnative.dev/docs/scrollview)
- [react-native-view-shot](https://github.com/gre/react-native-view-shot)
