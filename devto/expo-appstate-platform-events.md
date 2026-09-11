---
title: "React Native AppState: inactive, background, and focus are different signals"
published: false
description: "React Native AppState: inactive, background, and focus are different signals"
tags: reactnative, expo, javascript, testing
canonical_url: null
---

When writing work that runs as an application returns, distinguish the state reported by change from Android's focus and blur events. Opening the notification drawer does not necessarily put the application into background.

Supplying events to the JavaScript implementation in React Native 0.81.5 invoked blur and focus callbacks without invoking change. currentState remained active. Decide whether the operation needs a lifecycle state or Android interaction focus before choosing its trigger.

## Do not assume identical event sequences across platforms

The [official AppState documentation](https://reactnative.dev/docs/appstate) was checked on September 11, 2026. active describes foreground execution and background describes background execution. inactive is an iOS state that can occur during foreground transitions and some system interactions.

Android exposes focus and blur separately from change. The documentation gives opening the notification drawer as an example where AppState does not change but blur fires. Expecting Android to emit inactive with the same meaning can produce different resume behavior across platforms.

The pinned native sources were also inspected. On iOS, RCTAppState.mm maps UIApplication state and notifications to active, background, or inactive and suppresses repeated reports of the same state. Android's AppStateModule.kt maps onHostResume to active and onHostPause to background; it emits window-focus changes separately. It has no equivalent mapping to iOS inactive.

These findings compare a specific implementation with current documentation. They are not an event catalog measured by repeating the same gestures on every OS version.

## Vary the input to the actual JavaScript implementation

The environment was macOS 26.6.2, Node.js 24.15.0, Expo 54.0.33, and React Native 0.81.5. The test loaded the installed AppState.js, replacing only the NativeEventEmitter and native-module boundaries.

| Input | Observed result |
| --- | --- |
| Initial state active; focus false, then true | blur once, focus once, change zero times; currentState remains active |
| State events inactive, background, then active | change receives those same three values |
| Two consecutive active state events | The change callback runs twice |
| background after removing a change subscription | That subscriber is not called; currentState itself becomes background |

The repeated-active case demonstrates that a JavaScript change subscription does not deduplicate the values it receives. This does not contradict native iOS deduplication: the test injects events after that native boundary.

Initial retrieval was tested as well. With the initial constant set to null and the native retrieval callback returning active, change received active. When a background event arrived before that callback, the late active result did not overwrite currentState. This checks the guard between initial retrieval and a state event that has already arrived.

The documentation qualifies the possibility of a null currentState at startup with legacy architecture. The null input tests that branch; it is not evidence that the New Architecture fixture actually started with null.

## What an existing resume effect listens for

The circle-hub [notification code](https://github.com/takahiro-saeki/circle-hub/blob/a34608c611ded6549c1176a7977e68e1bc62a8db/apps/mobile/src/lib/push-notifications.ts), inspected at commit `a34608c`, contains an effect that clears the badge on mount and when it receives active. That effect was extracted from the actual source and executed with a substitute notification API.

The badge-clear function ran once after mount and twice in total after inactive, background, and active were supplied. Neither blur nor a state event after cleanup increased the count. This checks when the effect calls the substitute API; it does not verify the display or removal of a real badge. The original application was unchanged.

Receiving active is a different condition from returning only when the previous state was background. The former can be appropriate when initial state delivery or a return from inactive should also trigger work. Restricting work to a return from background requires retaining and comparing the previous value. Choose the condition according to the operation, such as clearing a badge or fetching fresh data.

## A small subscription for device observation

This is the subscription used in the fixture. trace records a launch identifier, a sequence number, and the value without initiating navigation or data retrieval. Import AppState from react-native and place this fragment inside the root effect.

```js
const state = AppState.addEventListener('change', value => trace('app-state', { value }));
```

Call state.remove during effect cleanup. If a screen mounts repeatedly, adding subscriptions without removing them can multiply the work triggered by one event. Keep registration and cleanup together.

In a Release application on the iOS 26.5 Simulator, currentState was inactive in both recorded launches. One background event was recorded after another application was launched. The Mac was locked, and a complete foreground return could not be confirmed through interaction and logs. These observations are not presented as a normal, complete startup-and-resume sequence. Opening the Android notification drawer was not tested on a device either.

## Reproduction and choosing the trigger

Install the locked dependencies in mobile-batch15 from the [experiment directory](https://github.com/takahiro-saeki/articles/tree/codex/article-stock-2026-09/experiments/article-stock-2026-09), then run `node experiments/article-stock-2026-09/probe-mobile-js-batch15.mjs` from the repository root. It uses the package JavaScript and the effect from the pinned repository. OS event generation and the notification API are substituted, so passing these tests does not replace device verification.

Start by logging change, focus, and blur separately, then check which signals the relevant interaction actually produces. Use the observed events to choose when the operation should run. If data requests overlap, changing the event name alone is insufficient; the work also needs control over duplicate execution. That control was not implemented as part of this experiment.
