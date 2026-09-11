---
title: "What EAS Update error recovery can roll back: seven iOS pipeline cases"
published: false
description: "Executing the original Swift recovery pipeline with explicit test doubles separates relaunch decisions from device recovery."
tags: [expo, reactnative, ios, swift]
canonical_url: "https://zenn.dev/hirodeath/articles/eas-update-error-recovery-boundary"
---

If EAS Update distributes broken JavaScript, will the application automatically return to an earlier version? `expo-updates` includes error recovery, but the available recovery attempts change around the first displayed content. Launching a new update and falling back to a cached update are separate tasks.

This experiment compiles the original iOS `ErrorRecovery.swift` and executes seven cases with external dependencies replaced by test doubles. **Identify which launch candidates remain available, rather than treating error recovery as a rollback of device data**.

## Executed code and explicit test doubles

The experiment ran on September 11, 2026, targeting `expo-updates` 29.0.18 installed locally for Voices Diary. The package's npm gitHead identifies the [same file in Expo's official repository](https://github.com/expo/expo/blob/45c60e10956764bbac6c62454890eeb25c74bbd6/packages/expo-updates/ios/EXUpdates/ErrorRecovery.swift). Its bytes matched the local file.

Apple Swift 6.3.3 compiled it on macOS in Swift 5 language mode. The original task pipeline, DispatchQueue, and timers executed unchanged. The React Native bridge, update database, download operation, and actual relaunch were test doubles. Error logs went into a temporary directory.

Below, "relaunch" means a call to the relaunch delegate, and "crash" means a call to the delegate that throws the exception. This was not an update distributed to an iPhone followed by a verified recovery on screen.

## Before content appears, new and cached updates can be candidates

The pipeline starts with tasks to wait for a remote update, launch a new update, launch a cached update, and throw an exception. It removes candidates according to the current state.

When content had not appeared and the update had no previous successful launches, the pipeline requested a failed-launch record. With a new update already ready, the new-update task called relaunch.

With no new update and launch checks set to `Never`, it moved to the cached-update task. When the relaunch double reported failure, the pipeline requested exception delivery. An earlier version cannot be assumed to remain on the device or launch successfully.

| Condition | Requests and tasks selected by the original pipeline |
| --- | --- |
| Before content, 0 previous successes, new update ready | Mark failure, request launch of new update |
| Before content, 0 previous successes, checks Never | Mark failure, request launch of cached update |
| Same condition, relaunch double reports failure | Mark failure, request cached launch, throw exception |
| After content appeared on this launch, new update ready | Mark success, throw exception; no relaunch request |
| Before content, 1 previous success, checks Never | Throw exception; no failed-launch record or relaunch request |
| Before content, 1 previous success, new update ready | Request new-update launch; no failed-launch record |
| Before content, 0 previous successes, update check times out | Mark failure, start download, request cached launch |

Task names were also checked against messages emitted by the original logger calls. A relaunch call alone would not distinguish the new-update task from the cached-update task.

## Separate content shown now from a previous successful launch

Receiving content appeared on the current launch requested a successful-launch record and reduced the pipeline to waiting for a remote update and throwing the exception. Even with a new update already ready, it did not request an immediate relaunch.

A previous successful-launch count follows a slightly different branch. The implementation removes the cached-update task, but that branch alone does not remove the new-update task. The case with 1 previous success and a new update ready did request that launch.

The [official error recovery guide](https://docs.expo.dev/eas-update/error-recovery/) groups content appeared on the current or a previous launch together, describing a fix-forward flow that prepares an update for a subsequent launch. The source experiment for this particular version exposed different immediate-relaunch behavior between those conditions. The operational guide and a version-specific branch are not guarantees at the same level of detail.

The relevant decision is that neither state should be treated as permission to fall back to an earlier working version. After content appears, the application may have changed persistent data into a new format. Being able to launch old JavaScript and having that JavaScript understand current stored data are separate checks.

## A timer is not an exact recovery-time promise

The source sets remote-update waiting to 5,000ms. The experiment used that value and started a download without sending its completion notification. After timeout, the pipeline requested a cached-update launch.

The first verifier slept for only 5.2 seconds and inspected the state before the task completed. Waiting for notification of the relaunch request corrected the verifier. A timer schedules work after a deadline; it does not promise an exact recovery duration including OS scheduling.

The source also removes error handlers 10 seconds after content appeared. These seven cases did not measure that monitoring cutoff. It remains a separate limitation: a mechanism handling early fatal JavaScript errors is not evidence of recovery from native crashes or every failure during a long session.

## An instruction to use the embedded update is a different operation

EAS Update also supports rolling back to a previously published update or to the update embedded in the build. Those are distribution-side instructions documented under [Rollbacks](https://docs.expo.dev/eas-update/rollbacks/), rather than the local error-recovery branches executed here.

This experiment replaced the update database and selection behavior with doubles. It did not verify the selected update ID or whether the embedded update was chosen. A task called `launchCached` does not establish that recovery always selects the embedded update.

An OTA update also cannot replace the native code in the build. That is the compatibility boundary described by [runtime versions](https://docs.expo.dev/eas-update/runtime-versions/). Preventing calls to unavailable native capabilities, preserving stored-data compatibility, and maintaining server API compatibility require separate checks.

## Keep recovery cases for the actual application

The [runner](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/probe-expo-error-recovery.py) retains the source-byte comparison and expectations for all seven cases. It does not distribute updates or perform a production recovery.

Application tests need to distinguish an initial failure before content appears, a failure after content appears, and a device that previously launched the same update successfully. Then check whether the intended fallback understands that device's stored data. A recovery plan depends on launching a viable candidate with the device's actual history and state, beyond merely having error recovery installed.
