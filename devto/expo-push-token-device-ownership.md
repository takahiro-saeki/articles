---
devto_id: 4646242
title: "A push token per user is not enough: device-scoped registration and logout"
tags: expo, reactnative, database, typescript
canonical_url: https://zenn.dev/hirodeath/articles/expo-push-token-device-ownership
published: true
---

Delivering notifications to someone using two phones requires more than changing the recipient into an array. Registering the second phone must preserve the first, and logout must deregister only the device performing it.

In SquadNote's multi-device work, the main change concerned the scope of registration and deregistration. Push tokens already had their own table and a uniqueness constraint on the token. The API and mobile code needed to use that structure as multiple registrations per user.

This article examines commit `ad0a669` in `circle-hub` and the containing revision `0cda1e8`. The focused tests were rerun on September 11, 2026. This describes implementation and local verification, not a completed rollout or confirmed reception on both operating systems.

## Separate the user from the delivery destinations

The existing schema has `id`, `userId`, `token`, `platform`, and `createdAt`, with a lookup index on `userId` and a unique index on `token`.

With the table name and ID generation simplified for the article, its structure is:

```sql
CREATE TABLE push_token (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL
);
CREATE INDEX push_token_user_idx ON push_token(user_id);
```

The real schema also has a foreign key to the user table and a creation timestamp. They are omitted here to focus on token ownership.

Leaving `user_id` non-unique allows several rows per person. `user_id + platform` should not be unique either: two iPhones still represent two destinations, despite sharing an operating system.

The same `token`, however, does not need duplicate rows. Using the token itself as the conflict target prevents a registration on every launch from accumulating rows.

The [Expo FAQ](https://docs.expo.dev/push-notifications/faq/) describes situations in which an Expo Push Token can change, including reinstallation on Android. Store it as a current notification destination, not a permanent hardware identity.

## Registration must preserve other devices

The updated registration API upserts the supplied token using the authenticated session's user ID. It does not delete all registrations for that user first.

```sql
INSERT INTO push_token (id, user_id, token, platform)
VALUES ('registration-a', 'user-a', 'token-ios', 'ios')
ON CONFLICT(token) DO UPDATE SET
  user_id = excluded.user_id,
  platform = excluded.platform;
```

This handles two cases. Registering the same token for the same user updates its existing row. Switching accounts in the same installation changes only that token's owner. Other tokens remain untouched.

The production code uses Drizzle's `onConflictDoUpdate` with `pushTokens.token`. A preceding `findFirst` decides whether to record an analytics event. The uniqueness constraint and upsert prevent duplicate registration; the preliminary lookup does not provide that guarantee.

```text
user-a: token-ios, token-android
  re-register token-android under user-b
user-a: token-ios
user-b: token-android
```

This illustrates the relationship stored by the API. Accepting a token string does not itself prove possession of a device. Authentication for registration and keeping tokens out of public logs remain separate responsibilities.

## Match both the user and token when deregistering

Normal logout matches the current user and the token for the device performing the operation.

```sql
DELETE FROM push_token
WHERE user_id = 'user-a' AND token = 'token-android';
```

Deleting by `user_id` alone removes other devices too. Deleting by `token` alone could remove a new account's registration if an old user's delayed logout arrives after an account switch. Matching both avoids deleting a token now owned by `user-b` in response to a request from `user-a`.

Account deletion retains a separate operation that removes all registrations. Logout and account deletion need different deletion scopes.

## Correct SQL does not resolve a registration/logout race

Logging out during an in-flight registration can produce this order:

```text
1. The device calls the registration API
2. Logout calls the deregistration API
3. Deregistration completes
4. Registration completes later
```

Registration begins, logout requests deregistration, deregistration finishes, and the original registration finishes last. The registration is left behind, so correcting the DELETE condition alone is insufficient.

The implementation's `DevicePushSession` tracks both pending registration and pending logout Promises. Once logout begins, it refuses new registrations and waits for the current registration to finish before deregistering. A second logout returns the same pending Promise.

Local storage and API persistence also need a defined order.

```ts
async saveToken(token: string, save: () => Promise<unknown>) {
  const tokens = (await this.storage.read()) ?? [];
  await this.storage.write([...new Set([...tokens, token])]);
  await save();
}
```

This method is extracted from the implementation. Saving the local token list first preserves the deregistration target if the server saves successfully but its response is lost. When a token changes, previous values remain recorded as deregistration targets for the same installation.

The installation stores that list in SecureStore. If deregistration fails, the implementation retains authentication and the list, displays a logout failure, and allows a retry. This means normal logout cannot finish while offline. That behavior needs a different user explanation from a design that always clears authentication immediately.

## What the rerun tests establish

The test environment was Node.js `v24.15.0` and Vitest `4.1.4`. Mobile dependency declarations specify Expo `~54.0.33` and React Native `0.81.5`; the tests themselves execute in Node.

```bash
pnpm --filter @squadnote/web exec vitest run src/security/push-token-privacy.test.ts
pnpm --filter @squadnote/mobile exec vitest run src/lib/device-push-session.test.ts
```

All 8 web tests and 9 mobile tests passed. The web tests use in-memory libSQL and the actual tRPC router, with external HTTP mocked. The mobile tests substitute test functions for storage and API operations.

| Check | Result |
| --- | --- |
| iOS, Android, and several tokens for one OS | Multiple rows preserved |
| Duplicate and concurrent registration of one token | Row and ID preserved |
| Device deregistration and account transfer | Unrelated registrations preserved |
| Unauthenticated registration and deregistration | Rejected |
| Notifications disabled and invalid tokens | Recipients filtered; only invalid tokens removed |
| Lost responses, registration/logout races, and deregistration failure | Local records and retry ordering checked |

These tests do not measure concurrency in production D1 or verify that an operating system displays a notification. The sender inspects tickets returned when submitting to Expo; that does not establish implementation of later receipt retrieval. Expo accepting a request must not be reported as device reception.

## Old clients can still deregister every device

The compatibility endpoint `unregisterAllPushTokens` remains available. An old client calling it during logout can remove other devices' tokens. Updating the server alone does not make every installed client version safe.

Tokens already removed by the old implementation cannot be recovered from the database. Each device must launch the app and register again.

The repository's device-verification checklist was unchecked when inspected. The evidence supports registration uniqueness, ownership transfer, deregistration scope, and ordering under intersecting requests. Actual delivery to two phones remains a separate verification step after the compatible application version is installed on both.

Implementation source: [multi-device push requirements and verification criteria](https://github.com/takahiro-saeki/circle-hub/blob/0cda1e865ad80d1529197729d8d436e96d56edc7/docs/multi-device-push.md)
