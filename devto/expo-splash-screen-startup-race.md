---
title: "A loaded font is not enough to hide the Expo splash screen"
published: false
description: "A loaded font is not enough to hide the Expo splash screen"
tags: expo, reactnative, javascript, testing
canonical_url: null
---

The first screen can still be waiting for authentication after its font has loaded. The hide condition needs to include readiness of the content the application intends to show first.

A Release application on the iOS Simulator compared two places to call hide while keeping font loading and a substitute authentication wait the same. Hiding after the font loaded happened with authReady false. Hiding after content layout happened with authReady true. The experiment checks call ordering; it does not measure how long a blank screen was visible.

## What the fixture waits for

The checks ran on September 11, 2026, with macOS 26.6.2, the iOS 26.5 Simulator, Expo 54.0.33, React Native 0.81.5, Expo Router 6.0.24, expo-font 14.0.12, and expo-splash-screen 31.0.13. The application was built in Release configuration so that Expo Go's appearance would not be treated as the production result.

The current [SplashScreen documentation](https://docs.expo.dev/versions/latest/sdk/splash-screen/) explains that Expo Go and development builds do not fully reproduce the production splash experience from SDK 52 onward and recommends checking a Release build. Its latest recommended package version is ~57.0.8, distinct from the 31.0.13 executed here.

The fixture passes a bundled font to useFonts and substitutes a localhost HTTP response for asynchronous authentication readiness. That server waits 4000 milliseconds before returning ready. This fixed delay makes the ordering difference observable; it is not a measurement of authentication speed. No credentials or real accounts were involved.

## Request manual control before rendering

The root module ran this code outside the component. trace adds an identifier for each launch and a sequence number to the record.

```js
trace('prevent-request');
void SplashScreen.preventAutoHideAsync().then(value => trace('prevent-result', { value }));
```

The official guidance recommends calling preventAutoHideAsync in global scope without awaiting it. Waiting until a component or effect runs can be too late because the splash screen may already have hidden. The call returned true in both recorded launches.

This stops automatic hiding. It does not automatically combine font loading, authentication, and content layout into one readiness operation.

## Compare font readiness with content layout

The root returns null until fontsLoaded or fontError is available, authReady is true, and the comparison mode has been loaded. Finishing the font operation alone therefore does not necessarily make the root return its content.

In early mode, an effect calls hideAsync as soon as the font result is available. In coordinated mode, the View returned after the readiness condition calls it from onLayout. The latter callback is:

```js
() => {
  trace('content-layout', { mode, authReady });
  if (mode === 'coordinated') {
    trace('hide-request', { mode, authReady });
    void SplashScreen.hideAsync().then(() => trace('hide-result', { mode }));
  }
}
```

The fixture holds mode and authReady in root state and passes this callback to the View's onLayout. An application that handles repeated layouts may also need a condition to avoid repeated hide calls. This comparison covers ordering during the initial launch.

| Condition | Recorded order | State when hide was called |
| --- | --- | --- |
| early | font-ready → hide-request → hide-result → auth-ready → content-layout | authReady was false |
| coordinated | font-ready → auth-ready → content-layout → hide-request → hide-result | authReady was true |

Some HTTP log records arrived out of order. The table orders them by their sequence number within each launch. Delivery order at the collector is not treated as execution order inside the application.

## Resolution of hideAsync does not prove readiness

In the pinned expo-splash-screen JavaScript implementation, hideAsync wraps hide. It does not receive the font or authentication Promise and does not wait for either. The early case recorded hide-result before auth-ready.

A View's onLayout is also a layout notification, not the exact time the first frame becomes visible to a person. The Mac was locked, so native visual inspection and frame measurement were unavailable. The experiment does not establish how many seconds of blank display were removed or that flicker is absent on every launch. Android remains untested.

The observed difference is whether application prerequisites are satisfied before hide is called. Treating a font failure as ready, using a fallback font, or rendering an error screen is a separate display decision. The fixture stops waiting on fontError too, but the font loaded successfully in the recorded comparison.

## Keep the existing authentication guard separate

The circle-hub [application layout](https://github.com/takahiro-saeki/circle-hub/blob/a34608c611ded6549c1176a7977e68e1bc62a8db/apps/mobile/src/app/%28app%29/_layout.tsx), inspected at commit `a34608c`, returns an ActivityIndicator until its authentication check finishes and delays enabling notification handlers. The inspected root layout does not contain this experiment's manual hide control.

That implementation handles a notification-navigation race. This comparison checks the condition for hiding the splash screen. The fixture's View and hide logic were not applied to the existing application. If an authentication guard already returns a waiting screen, that screen can itself be chosen as the initial content.

The [fixture application](https://github.com/takahiro-saeki/articles/tree/codex/article-stock-2026-09/experiments/article-stock-2026-09/mobile-batch15) and local collector record the font result, authentication wait, layout, and hide separately. The experiment README records the steps: install locked dependencies, generate the iOS project, install Pods, build Release, and install it into the Simulator. There was no cloud build, store submission, or external distribution.

Before adding manual hide control, decide what should be visible first and what that content depends on. Recording the prerequisites immediately before hide provides a reason to change its condition; merely recording that hide was called does not.
