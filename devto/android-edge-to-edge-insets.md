---
title: "Tracing Android safe-area spacing to the components that apply insets"
tags: android, reactnative, expo
canonical_url:
published: false
---

Before changing bottom spacing, find which components consume `insets.bottom`. A parent `SafeAreaView` and a child's `paddingBottom` can avoid the same area, potentially adding extra space even when the library reports correct values.

This is an investigation procedure based on reading SquadNote's code, not a report of reproducing and fixing a specific spacing bug on a device. The source is `circle-hub` commit `31e560d`, using Expo SDK 54, React Native `0.81.5`, and a `react-native-safe-area-context` declaration of `~5.6.0`. It was inspected on September 11, 2026.

## Separate OS conditions from application configuration

The [Android documentation](https://developer.android.com/develop/ui/views/layout/edge-to-edge) describes enforced edge-to-edge display on Android 15 or later when the application targets SDK 35 or higher. The target SDK matters as well as the device's OS.

SquadNote has `edgeToEdgeEnabled: true` in its configuration. Finding that setting does not establish that interactive controls avoid the system bars. Follow both the configuration that extends the background to the edges and the code applying insets to interactive areas.

System bars, display cutouts, and system gesture regions are also different categories. This React Native code uses the library's top and bottom insets. How those values change on a device needs separate checks with navigation mode and orientation controlled.

## Distinguish the Provider from the View applying spacing

The relevant structure of authenticated screens is:

```text
SafeAreaProvider
  View
    Header       → paddingTop: insets.top
    View / Stack → individual screens
    BottomNav    → paddingBottom: insets.bottom
```

Having a `SafeAreaProvider` is different from adding padding to every child screen. The library's official [SafeAreaProvider](https://appandflow.github.io/react-native-safe-area-context/api/safe-area-provider/) and [SafeAreaView](https://appandflow.github.io/react-native-safe-area-context/api/safe-area-view/) documentation separates providing values from applying them as spacing.

BottomNav places the bottom inset outside a container with the navigation bar's own height.

```tsx
const insets = useSafeAreaInsets();

return (
  <View style={[styles.container, { paddingBottom: insets.bottom }]}>
    <View style={{ height: layout.bottomNavHeight }}>
      {/* Navigation items */}
    </View>
  </View>
);
```

This excerpt keeps the layout from the implementation and omits the buttons and color definitions. Separating inner height from outer padding avoids changing the buttons' own height just to clear the bottom edge.

The public route group instead has no Header or BottomNav and wraps its Stack in `SafeAreaView`. Different route groups in the same application have different owners for safe-area spacing.

## Trace the same edge when investigating double application

Suppose another `SafeAreaView` covering the bottom edge is added inside an authenticated screen. Whether spacing actually overlaps depends on Provider placement and the screen's region. Component names alone do not prove duplication. Check whether parent and child are both configured to avoid the same bottom-edge region.

For one target screen, collect:

| Information | Where to inspect |
| --- | --- |
| The region against which insets are measured | Nearest SafeAreaProvider and its layout |
| Which edges are applied | SafeAreaView's `edges` |
| Manual additions | `paddingTop`, `paddingBottom`, and margins |
| Changes of region | Providers and layouts for modals or different routes |
| Actual values and rendering | Device insets, container boundaries, and button positions |

In its normal additive mode, SafeAreaView adds insets to specified padding. For example, padding of 16 plus a bottom inset of 24 produces 40. Those are illustrative values, not measurements from a device in this investigation.

Choose whether to remove an edge or manual padding based on which component owns that edge. Subtracting a fixed value whenever spacing looks too large leaves assumptions that may fail with a different navigation mode or orientation.

## Treat startup crashes separately from spacing

The working copy that prompted the investigation is named `android-safe-area-hotfix`. However, the [actual fix](https://github.com/takahiro-saeki/circle-hub/commit/31e560d) changes the safe-area-context dependency declaration, lockfile, QA build configuration, and tests. It does not change inset or padding code.

Rerunning its focused tests with Node.js `v24.15.0` and Vitest `4.1.4` passed both tests. They check the dependency declaration and QA configuration.

```bash
pnpm --filter @squadnote/mobile exec vitest run src/lib/android-native-runtime.test.ts
```

Passing those tests does not establish correct screen spacing or guarantee that a native startup crash will not recur. If the app crashes before the screen opens, inspect the native error first. If the screen opens with misplaced content, trace where spacing is applied.

Authenticated and public routes assign inset handling to different components. Select the target route, identify who handles its bottom edge, then compare that implementation with the values and positions on a device.
