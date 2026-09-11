---
title: "Expo Router initial URLs and runtime URL events follow different paths"
published: false
description: "Expo Router initial URLs and runtime URL events follow different paths"
tags: expo, reactnative, javascript, testing
canonical_url: null
---

When investigating navigation during Expo Router startup, record the initial URL result separately from later URL events. Check the initial wait and the later event subscription separately.

A test of Expo Router 6.0.24 replaced only the native API and timer boundaries. In its Android branch, firing the timeout before the initial URL resolved produced a fallback to the root. Resolving the initial-URL Promise afterward did not change that settled result. A separately emitted runtime URL event still reached its subscriber.

## Identify the entry point first

The React Native [Linking documentation](https://reactnative.dev/docs/linking) describes getInitialURL for a URL that launches the app and a url event for an app that is already open. These are the entry points visible to application code. A JavaScript unit test cannot establish which one the OS will invoke in every application state.

Expo Router includes link handling. The [Expo guide](https://docs.expo.dev/linking/into-your-app/) distinguishes Router usage from manually handling Linking. A diagnostic subscription that only observes URLs does not need to call router.push. Doing so would add another navigation operation alongside the Router's own handling.

For context, the circle-hub [root layout](https://github.com/takahiro-saeki/circle-hub/blob/a34608c611ded6549c1176a7977e68e1bc62a8db/apps/mobile/src/app/_layout.tsx) and [notification code](https://github.com/takahiro-saeki/circle-hub/blob/a34608c611ded6549c1176a7977e68e1bc62a8db/apps/mobile/src/lib/push-notifications.ts) were inspected at commit `a34608c`. The application navigates from notification responses, but its root layout does not implement a custom getInitialURL wait. This experiment is not evidence of a missed URL in that application.

## The pinned version takes different paths on iOS and Android

The checks ran on September 11, 2026, using macOS 26.6.2, Node.js 24.15.0, Expo 54.0.33, React Native 0.81.5, Expo Router 6.0.24, and Expo Linking 8.0.12. The fixture pins a Router version compatible with its SDK. The reference repository declares Router 5.0.7, which is not the version executed here.

The tests executed link/linking.js and getLinkingConfig.js from the installed package. Every URL below is synthetic.

| Condition | Initial URL result | What was checked |
| --- | --- | --- |
| The iOS synchronous getter returns a URL | articlelab://detail?item=cold | One call to the Expo Linking synchronous getter |
| The iOS synchronous getter returns null | articlelab:/// | Fallback to the root |
| The Android read resolves before the timer | articlelab://detail?item=early | The initial URL is accepted |
| The Android timer fires first | articlelab:/// | A later initial result does not change the outcome |
| The Android read rejects first | Rejection | This branch does not turn the failure into a successful root result |

The Android path contains a Promise.race with a 150 millisecond timer. The test checked that the timer argument was 150, then explicitly invoked the callback instead of waiting 150 milliseconds. It changes the ordering of competing operations; it does not measure URL retrieval time on a device.

The iOS branch used Expo Linking's synchronous getter. The public description that React Native's getInitialURL returns a Promise is not enough to conclude that Router internals wait in the same way on both platforms.

## Separate a settled initial value from a subsequent event

The Android timeout condition used this sequence:

```text
1. Router starts reading the initial URL
2. The controlled timeout callback runs
3. Initial routing resolves to articlelab:///
4. The native initial-URL Promise resolves late
5. The settled initial result remains articlelab:///
6. A separate runtime URL event reaches the subscriber
```

The test emitted the final event independently. A late initial result was not automatically converted into a url event. Investigating delivery on a device requires records from both entry points.

Calling the initial reader returned by getLinkingConfig twice also returned the same Promise, with one native read. For this version's configuration object, repeated calls cannot be relied on to retrieve a fresh initial URL.

## Observe the application without adding navigation

The fixture made this call at module load. Its trace function attaches an identifier for each launch and a sequence number, then sends the record to a local collector.

```js
export const initialURL = Linking.getInitialURL().then(url => {
  trace('initial-url', { url });
  return url;
});
```

The root effect also subscribes to url events, and changes in usePathname are recorded separately. Different event names for the returned URL, the received event, and the Router pathname distinguish a missing value from navigation that does not follow an available value. Production URLs may contain sensitive information, so diagnostic records should retain only the necessary fields, such as the relevant path. All values here belong to the fixture.

A Release build ran in an iOS 26.5 Simulator. In both launches without a URL, React Native's getInitialURL returned null and the recorded pathname was /. These records do not directly observe the Router's internal synchronous getter.

The Mac was locked and graphical interaction was unavailable. Although simctl openurl exited successfully, neither a received URL nor a new launch trace was observed afterward. Native cold-start link delivery and delivery to an already running app therefore remain unverified. No Android device run was performed.

## Reproduction and what the result supports

Install the locked dependencies in mobile-batch15 from the [experiment directory](https://github.com/takahiro-saeki/articles/tree/codex/article-stock-2026-09/experiments/article-stock-2026-09), then run `node experiments/article-stock-2026-09/probe-mobile-js-batch15.mjs` from the repository root. The test loads the actual package JavaScript while controlling native calls, event emission, and timers. It does not reproduce OS link delivery.

Test a late initial-Promise resolution separately from delivery of a runtime url event. If an event arrives but navigation differs, inspect authentication guards and Router state next. Adjusting only the initial wait cannot reveal that distinction.
