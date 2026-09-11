---
title: "Auditing maintenance across two apps by web, OTA, and native release paths"
published: false
description: "SquadNote and Voices Diary share frameworks but differ in release profiles, runtime policies, and notification scope."
tags: [expo, nextjs, webdev, productivity]
canonical_url: "https://zenn.dev/hirodeath/articles/solo-web-ios-maintenance-scope"
---

Two services built with Next.js and Expo do not necessarily share the same maintenance commands or acceptance checks. Identically named configurations can point to different distribution methods or API environments.

That difference appears in the `preview` profiles of SquadNote and Voices Diary. The former uses internal distribution, while the latter uses store distribution. Both point to their production API domains. The name "preview" does not establish that a build avoids production data.

To understand maintenance scope, inventory how changes reach users and what must be checked afterward. This article records a source audit performed on September 11, 2026. It is not a personal account claiming that maintenance time multiplied by a measured factor.

## Do not treat an old README as the current architecture

The audit used SquadNote at `d116e8a` and Voices Diary at `6143bb9`. It read committed Git objects without incorporating working-tree changes.

Voices Diary's root README still describes a web-only application whose implementation has not begun. Yet the same commit contains `apps/web`, `apps/mobile`, mobile configuration, a login screen, and notification code. The September 4 commit `6143bb9` changes navigation after iOS authentication.

Concluding from that README that there is no mobile maintenance would contradict the implementation. Conversely, the existence of configuration does not establish that every device running the store app has this version. The audit concerns fixed repository contents.

The [Voices Diary snapshot](https://github.com/takahiro-saeki/voice-training-log/tree/6143bb99873ccf04b134dad4ac6b12c6e7a02d48) and [SquadNote snapshot](https://github.com/takahiro-saeki/circle-hub/tree/d116e8a343e8d9e7ddd3d1985efe590fa1901868) are the reference points. Anything requiring knowledge of deployed or distributed versions remains unverified.

## Read distribution and API targets separately

The following maintenance-relevant fields come from `apps/mobile/eas.json` and `app.config.ts`.

| Field | SquadNote | Voices Diary |
| --- | --- | --- |
| Version in app.config | 1.0.13 | 1.1.0 |
| runtimeVersion policy | appVersion | fingerprint |
| preview distribution | internal | store |
| preview channel | preview | preview |
| preview API | Production domain | Production domain |
| Build profiles using the development API | development, qa | development |

The version row contains file values, not verified latest store versions. The preview API targets were `squad-note.com` and `voicesdiary.com`, respectively. Distribution method, update channel, and API environment need separate checks.

Sharing Expo is not enough reason to copy one service's release procedure into the other. Before producing a verification build, identify its API target and the binary receiving the change. Choosing a profile merely because it is called preview does not answer those questions.

## Web, OTA, and native changes require different evidence

The Voices Diary TestFlight runbook separates web deployment, JavaScript updates, and rebuilding after native changes. That distinction can also organize maintenance records for both services.

| Change path | Example verification targets | Evidence needed to close the work |
| --- | --- | --- |
| Web and API | Authentication, permissions, data format | Commit, environment, and results from clients using the API |
| OTA | JavaScript screens or notification settings | Target runtime, channel, and results on a device that applied the update |
| Native build | URL schemes, native dependencies, OS configuration | New binary identification and device results |
| Documentation after distribution | Store text, usage guides, maintenance documents | Confirmation that the explanation matches its target version |

This is a proposed recording format. No deployment, OTA update, or store submission was performed for this audit.

[Expo's runtime version documentation](https://docs.expo.dev/eas-update/runtime-versions/) explains how runtimes govern compatibility between an update and native code. SquadNote's `appVersion` and Voices Diary's `fingerprint` determine that value differently. A matching runtime should not be treated as proof of correct JavaScript behavior or compatibility with the API.

The September 4 Voices Diary change gives a concrete example. Alongside JavaScript that waits before showing an Alert or navigating after login, it explicitly adds the app's scheme to `CFBundleURLTypes`. The latter concerns iOS configuration. A title such as "fix the login screen" cannot establish that OTA alone carries the entire change. The audit did not determine which distributed binaries include it.

## Notifications also mean different acceptance checks

The notification code serves different purposes in the two services.

SquadNote sends Push notifications using user preferences and registered devices. Voices Diary has weekday-based local reminders whose settings remain on the device, plus an administrator-only test of the remote notification path. Counting the latter as automatic messaging for ordinary users would overstate the implemented scope.

The [Voices Diary remote notification specification](https://github.com/takahiro-saeki/voice-training-log/blob/6143bb99873ccf04b134dad4ac6b12c6e7a02d48/docs/17-remote-notification-test.md) covers registration, sending, and receipt inspection. Its implementation includes an email allowlist and states corresponding to Expo tickets and receipts. Those states alone do not establish that a notification appeared on a device.

Instead of duplicating a generic "notification maintenance" task, name the behavior to verify. In SquadNote, check whether another device's registration survives. For Voices Diary's local reminders, check whether only selected weekdays are scheduled. For its administrator test, check whether an unauthorized user can send. Shared libraries do not make those acceptance conditions interchangeable.

## The audit identifies verification targets, not hours

This was a static comparison of configuration and source. Fixed commits and hashes were recorded for 20 files. It did not measure physical-device notifications, OAuth, store distribution status, or maintenance time.

The audit distinguishes a shared recording format from settings that need checking for each service. A format for recording evidence by release path can be common. API targets, runtime policies, notification audiences, and published guidance still require individual checks.

The next maintenance task should identify the service, how the change reaches it, and the device or environment where a particular result closes the work. Applying the same patch to two repositories does not establish that both sets of downstream checks have passed. Record those results separately.
