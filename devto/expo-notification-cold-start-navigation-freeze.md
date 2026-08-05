---
devto_id: 4290218
title: Why My Expo Router App Froze on the Splash Screen After a Cold-Start Notification Tap
tags: devchallenge, bugsmash, expo, reactnative
canonical_url: https://qiita.com/hiro123/items/9917943f00ec1d6a7d2b
published: true
---

> This is an English translation of my original article on [Qiita](https://qiita.com/hiro123/items/9917943f00ec1d6a7d2b).

*This is a submission for [DEV's Summer Bug Smash: Smash Stories](https://dev.to/bugsmash) powered by [Sentry](https://sentry.io/).*

My Expo app occasionally stayed on the splash screen when it was launched by tapping a push notification from a terminated state. Opening the app normally worked. Tapping a notification after the app had already started also worked.

The splash screen was not the cause. Two navigation operations were competing during startup.

## Authentication and notification navigation ran together

The authenticated layout checks for a token in SecureStore when it mounts.

```tsx
useEffect(() => {
  (async () => {
    const token = await getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    setAuthChecked(true);
  })();
}, []);
```

The same layout also started push token registration and notification response handling.

```tsx
useRegisterPushToken();
```

The notification hook called `getLastNotificationResponseAsync()` and opened the route stored in the notification data.

```ts
Notifications.getLastNotificationResponseAsync().then((response) => {
  if (response) handleNotificationTap(response.notification);
});
```

During a cold start, two operations could run at nearly the same time:

1. The authentication check called `router.replace("/login")` or allowed the authenticated layout to render.
2. The notification handler called `router.push(path)`.

Both ran before navigation had settled. The screen never appeared, so the app looked as if SplashScreen itself had frozen.

## Why the bug was difficult to reproduce

The failure depended on application state and launch order rather than on a single invalid route. A normal icon launch worked. Notification taps also worked after the JavaScript runtime and navigation tree were already active. Only a notification tap from a terminated state compressed authentication, route mounting, and notification handling into the same startup window.

That made the splash screen a convincing false lead. The visible symptom appeared before the first screen, while the actual fault was two valid navigation commands racing each other.

## Wait until authentication is ready

I changed the notification hook to accept an `enabled` flag.

```tsx
const [authChecked, setAuthChecked] = useState(false);

useEffect(() => {
  (async () => {
    const token = await getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    setAuthChecked(true);
  })();
}, []);

useRegisterPushToken(authChecked);
```

The hook does not start its effects while `enabled` is false.

```ts
export function useRegisterPushToken(enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    if (!Notifications) return;

    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) handleNotificationTap(response.notification);
    });

    const subscription =
      Notifications.addNotificationResponseReceivedListener((response) => {
        handleNotificationTap(response.notification);
      });

    return () => subscription.remove();
  }, [enabled]);
}
```

The app now handles the most recent notification only after authentication has finished and the authenticated layout can render. This removed the cold-start navigation race.

## The impact of the fix

The change established one owner for startup sequencing: authentication becomes ready first, then notification-driven navigation is allowed to run. It fixed the terminated-state launch without delaying notification taps while the app was already active.

It also made the behavior explicit in the hook API. Future callers can see that notification registration and response handling depend on readiness instead of relying on mount timing as an undocumented guarantee.

## Normalize the notification URL before navigation

Notifications created by different parts of the system could contain either a relative path or an absolute URL. I convert both forms into an internal path before calling Expo Router.

```ts
function handleNotificationTap(notification: Notifications.Notification) {
  const data = notification.request.content.data as
    | { url?: string; linkUrl?: string }
    | null;

  const raw = data?.url ?? data?.linkUrl;
  if (!raw) return;

  const path = raw.startsWith("/")
    ? raw
    : (raw.match(/^https?:\/\/[^/]+(\/.+)$/)?.[1] ?? null);

  if (!path) return;
  router.push(path as never);
}
```

Production code should verify the host before extracting a path from an absolute URL. The example above only shows the normalization step.

## Startup paths I tested separately

I checked each of these paths after the change:

- Normal launch from the app icon
- Notification tap while the app was terminated
- Notification tap while the app was in the background
- Notification tap while the app was visible
- Notification tap while logged out

A notification launch changes the initialization order. When an app appears stuck on its splash screen, it is worth checking whether authentication and deep-link handling are both trying to navigate during startup.

## What I learned

Cold starts are coordination problems. Authentication, persisted state, deep links, and notification responses may all be individually correct but still fail when they compete during initialization.

The useful debugging move was to test launch paths separately and model readiness directly. Once startup ordering became part of the code instead of an assumption, the apparent splash-screen bug became a small and testable navigation fix.

## Reference

- [Expo Notifications: Handle push notifications with navigation](https://docs.expo.dev/versions/latest/sdk/notifications/)
