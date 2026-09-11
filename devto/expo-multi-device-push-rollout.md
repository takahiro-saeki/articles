---
title: "A multi-device push rollout remains incomplete while old logout behavior survives"
published: false
tags: [expo, mobile, testing, migration]
canonical_url: https://zenn.dev/hirodeath/articles/expo-multi-device-push-rollout
---

A server can store multiple push tokens per user while an old application's logout still removes every device registration. The new API behavior alone does not describe the state of a rollout.

This investigation combined SquadNote's old and new APIs with old and new logout methods. Its focus is the combinations that can remain in use and the evidence needed to call the migration complete, rather than the registration and deletion implementation itself.

The source versions are `circle-hub` at `0cda1e8` and the parent of change `ad0a669`. Tests ran locally on September 11, 2026. No OTA update or notification to a physical device was sent.

## A migration can remain even without a new table

The [implementation specification](https://github.com/takahiro-saeki/circle-hub/blob/0cda1e865ad80d1529197729d8d436e96d56edc7/docs/multi-device-push.md) says the existing token table and unique-token constraint suffice without a database migration.

Before the change, registering a previously unregistered token also removed existing tokens for that user. Registering iOS and then Android left only the later registration.

The [updated API](https://github.com/takahiro-saeki/circle-hub/blob/0cda1e865ad80d1529197729d8d436e96d56edc7/apps/web/src/server/api/routers/notification.ts) upserts by token and preserves another device's registration. However, it retains `unregisterAllPushTokens` for compatibility.

The [mobile change](https://github.com/takahiro-saeki/circle-hub/commit/ad0a669) must also reach clients for ordinary logout to remove only that installation's tokens. Having an adequate server schema and having every caller use the new deletion scope are different conditions.

## Combine both server versions with both deletion methods

In disposable copies, the actual before-and-after tRPC routers were connected to the same kind of local libSQL database. An authenticated synthetic user registered an iOS value followed by an Android value. These were test strings, not actual Expo Push Tokens.

The comparison then selected either the old caller's all-device deletion or the new caller's device-specific deletion. It exercised the API calls rather than running the application UI and network end to end.

| Server | Deletion method | After 2 registrations | After Android-side logout |
| --- | --- | --- | --- |
| Before change | Delete all | Android only | 0 rows |
| Before change | Delete device | Android only | 0 rows |
| After change | Delete all | iOS and Android | 0 rows |
| After change | Delete device | iOS and Android | iOS only |

All four cases matched their assertions. Adopting only the new logout method cannot make the old server retain both destinations. Conversely, the new server still removes both if all-device deletion is called.

The “old server + device deletion” case reaches 0 because registering Android already removed iOS. Device-specific deletion did not itself remove the iOS row. Inspect both the post-registration and post-logout states instead of only the final count.

## Distribution does not restore deleted registrations

The test also registered iOS again after logout and confirmed that its row existed. That was the result of another registration call with the required input. Updating the server did not automatically reconstruct deleted rows.

A rollout therefore needs to distinguish distributing new code, applying it, and executing registration:

```text
Distribute the new code
  ↓
The target device downloads and applies it
  ↓
The device executes registration
  ↓
The required destinations exist on the server
  ↓
Verify logout preserves the other device
```

This is a proposed verification sequence. The investigation did not collect the rollout stage of actual user devices. It does not establish that everyone updated or that all registrations were restored.

## Matching runtimeVersion labels are insufficient evidence

The specification calls for updating Web/API first and then delivering compatible changes to both iOS and Android. It also records different native dependency configurations in the targeted builds for the two platforms.

[Expo's runtime-version documentation](https://docs.expo.dev/eas-update/runtime-versions/) requires updates to be compatible with the native code embedded in a build. Assigning the same identifier manually does not make different native configurations identical.

A rollout record can connect the API commit, each platform's build and runtimeVersion, the applied update, and the registration outcome. This article did not change delivery settings or infer successful distribution from local tests.

## Automated checks and the remaining receipt checks

The 4 additional cases passed alongside 8 existing registration, deletion, and sending tests, for 12 successful tests. The environment was Node.js `v24.15.0` and Vitest `4.1.4`. Tests used in-memory libSQL and the actual router code. External HTTP for notification sending was mocked.

The [reproduction runner](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/batch05-circle-tests.py) and [compatibility matrix test](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/push-rollout.test.ts) are recorded.

These checks establish how the specified calls change database registrations. They do not cover physical-device permissions, delivery after Expo accepts a message, OS notification presentation, or recovery from offline operation.

The original specification's physical-device checklist is also unchecked at the inspected revision. It calls for applying updates to both platforms, receiving on both devices, and receiving only on the remaining device after one logs out. A documented procedure is not evidence that it was executed.

A completion record should include the server test results, remaining callers, update application, recreated registrations, and actual receipt checks.
