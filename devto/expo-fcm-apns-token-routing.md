---
title: "Distinguish Expo, FCM, and APNs tokens by the API that accepts them"
published: false
tags: expo, firebase, notifications, typescript
canonical_url: null
---

When storing a push token, identify the service that accepts it as well as the string itself. An Expo Push Token passed to APNs, or an APNs token placed in an Expo Push API destination, is not interchangeable with the identifier expected by that service.

An Expo app can use Expo Push Service or send directly through FCM and APNs. Read the acquisition code and the sending server to check that they use the same path.

## Pair the acquisition API with the sending API

The [official Expo Notifications documentation](https://docs.expo.dev/versions/latest/sdk/notifications/) was checked on September 11, 2026. Its latest page recommends ~57.0.17. This table covers native iOS and Android acquisition.

| Value | Example acquisition API | Accepting service |
| --- | --- | --- |
| Expo Push Token | getExpoPushTokenAsync | Expo Push Service |
| Native Android token | getDevicePushTokenAsync | FCM |
| Native iOS token | getDevicePushTokenAsync | APNs |

An Expo Push Token identifies a destination to Expo, an FCM token to Firebase, and an APNs token to Apple. Check which API produced the value instead of choosing a sending service from the OS name alone.

Following the [Expo Push Service sending documentation](https://docs.expo.dev/push-notifications/sending-notifications/), an Expo-mediated path looks like this.

```text
App -> getExpoPushTokenAsync -> Expo Push Token -> Application server

Application server -> Expo Push Service -> FCM -> Android
Application server -> Expo Push Service -> APNs -> iOS
```

The application server uses the Expo Push Token when sending to Expo. On this path, Expo handles forwarding to FCM or APNs.

## FCM on iOS has a separate registration path

FCM is not limited to Android. [Firebase's Apple platform setup](https://firebase.google.com/docs/cloud-messaging/ios/get-started) describes mapping APNs tokens to FCM registration tokens.

With that architecture, the server uses an FCM destination and FCM handles delivery through APNs. The result of calling getDevicePushTokenAsync on iOS through expo-notifications cannot simply be renamed an FCM registration token. Registration and mapping on the Firebase side are separate requirements.

Even for the same goal of notifying an iOS app, the destination's meaning changes depending on whether the server sends directly to APNs, through Firebase, or through Expo.

## The inspected repository uses Expo's path

The source inspected here is circle-hub at fixed commit `a34608c`. Its dependency declarations specify Expo ~54.0.33 and expo-notifications ~0.32.17, so it is not the same environment as the latest documentation's recommended version.

The [acquisition code](https://github.com/takahiro-saeki/circle-hub/blob/a34608c611ded6549c1176a7977e68e1bc62a8db/apps/mobile/src/lib/push-notifications.ts) registers data from getExpoPushTokenAsync with the server. The [sending code](https://github.com/takahiro-saeki/circle-hub/blob/a34608c611ded6549c1176a7977e68e1bc62a8db/apps/web/src/server/api/lib/expo-push.ts) posts to the Expo Push API. Together, these match the Expo path in the table.

Changing only acquisition to getDevicePushTokenAsync would change the meaning of the destination received by the server. Such a change needs a review of the database semantics, sending service, and required credentials together. No such migration was performed for this article.

Token refresh and multiple-device ownership are further design concerns once the path is established. This review first checks that the registered value matches the sending service.

## Separate destination types instead of guessing from strings

A proposed design for supporting multiple paths is to include provider in the destination type. The original app does not already contain this addition.

```ts
type PushDestination =
  | { provider: "expo"; token: string }
  | { provider: "fcm"; token: string }
  | { provider: "apns"; token: string };

function makeExpoPayload(
  destination: Extract<PushDestination, { provider: "expo" }>,
) {
  return { to: destination.token, title: "Routing example" };
}
```

With TypeScript 7.0.2 and strict enabled, passing an expo destination compiled successfully. Separate comparisons passing apns and fcm both produced TS2322. These tests checked type confusion without sending anything.

The name makeExpoPayload also identifies the accepted destination more clearly than a generic "push JSON" builder. It does not mix another service's credentials or request format into this function.

The type does not establish a string's authenticity. JSON arriving from outside the application needs runtime checks, and a provider value of expo does not make its token valid. A token prefix alone cannot replace checks of the registration source and project.

## Keep token acquisition, acceptance, and display separate

An Expo sending ticket and a receipt describing delivery to FCM or APNs represent different stages. Obtaining a token alone verifies neither sending nor display.

This review covered official behavior, acquisition and sending paths in fixed code, and 3 type-checking cases. It did not obtain real tokens, configure credentials, send notifications, or inspect device display. Actual delivery still needs to be tested through the identified path.
