---
title: Handling Notification Taps in expo-notifications: Launch vs. Runtime
tags: Expo, React Native, Push Notifications, Expo Router
published: false
---

This article is an English translation of the original Japanese article.

When a user taps a push notification, the entry point differs depending on whether the app is running. If you only use one listener with Expo Router to navigate to the notification target screen, you may miss launches from the terminated state.

In my app, I handle both cases with two separate mechanisms:

- `getLastNotificationResponseAsync()`: when the app launches from a notification tap
- `addNotificationResponseReceivedListener()`: when a notification is tapped while the app is running

## Structuring Notification Data

The notifications sent from the server include the destination path in `data.url`.

```ts
{
  title: "Attendance Deadline Reminder",
  body: "Please confirm your attendance for tomorrow's practice",
  data: {
    url: "/organizations/org_123/schedules/schedule_456"
  }
}
```

Rather than parsing the displayed `title` or `body` to determine the destination, I pass a path the app can handle as separate data.

## Handling Launch from Notification

When the app is in a terminated state, I check for the last notification response after launch.

```ts
void Notifications.getLastNotificationResponseAsync().then((response) => {
  if (response) {
    handleNotificationTap(response.notification);
  }
});
```

This process is asynchronous. If you call `router.push` before verifying authentication or before the Navigator is ready, navigation can conflict. In my app, I run this after the login check completes.

```ts
useRegisterPushToken(authChecked);
```

## Handling Notification Taps While Running

When a notification is tapped from either the background or foreground, the listener receives it.

```ts
const subscription =
  Notifications.addNotificationResponseReceivedListener((response) => {
    handleNotificationTap(response.notification);
  });

return () => subscription.remove();
```

To avoid duplicate listeners from screen remounts or Fast Refresh, I call `remove()` in the cleanup.

## Unifying Both Entry Points

Although the entry points differ, notification data validation and navigation are shared.

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

For backward compatibility with previously sent notifications, I accept both `url` and `linkUrl`. For new implementations, using a single key is simpler.

Also, passing externally provided URLs directly to `router.push` is less safe. I define allowed hosts and path formats, converting them to app-internal routes before passing.

## Not Navigating on Received Notification

`addNotificationReceivedListener` and `addNotificationResponseReceivedListener` serve different purposes.

```ts
Notifications.addNotificationReceivedListener((notification) => {
  // When notification is received
});

Notifications.addNotificationResponseReceivedListener((response) => {
  // When user taps the notification
});
```

Switching screens immediately when a notification arrives can disrupt the user's current screen, such as an input form. In my app, screen navigation happens only with the response after a tap.

## Unified Hook

Simplifying the actual structure, it looks like this:

```ts
export function useNotificationNavigation(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    let active = true;

    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (active && response) {
        handleNotificationTap(response.notification);
      }
    });

    const subscription =
      Notifications.addNotificationResponseReceivedListener((response) => {
        handleNotificationTap(response.notification);
      });

    return () => {
      active = false;
      subscription.remove();
    };
  }, [enabled]);
}
```

Rather than treating launches from the terminated state and taps while running as the same thing, separating the entry points and then passing them to a common navigation function made the structure easier to maintain.

## References

- [Expo Notifications](https://docs.expo.dev/versions/latest/sdk/notifications/)
- [Expo: Handle incoming notifications](https://docs.expo.dev/push-notifications/receiving-notifications/)
