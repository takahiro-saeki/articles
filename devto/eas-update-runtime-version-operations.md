---
title: "Managing production, preview, and runtimeVersion after introducing EAS Update"
tags: expo, eas, reactnative, cicd
published: false
---

This article is an English translation of the original Japanese article.

I introduced EAS Update to an Expo app so that JavaScript and image changes could be delivered without store review. However, just getting the command to run is not enough for safe operation. You need `channel` and `runtimeVersion` to decide which builds receive updates.

Currently, I use three channels (development, preview, production) combined with the `appVersion` policy.

## Fix channel to build profile

In `eas.json`, each build sets the target API and channel.

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "channel": "development",
      "env": {
        "APP_ENV": "development",
        "EXPO_PUBLIC_API_URL": "https://dev.squad-note.com"
      }
    },
    "preview": {
      "distribution": "internal",
      "channel": "preview",
      "env": {
        "APP_ENV": "production",
        "EXPO_PUBLIC_API_URL": "https://squad-note.com"
      }
    },
    "production": {
      "autoIncrement": true,
      "channel": "production"
    }
  }
}
```

Preview is an internal distribution build using the production API. You can verify OTA updates under the same data conditions before releasing to production. Development connects to the dev API, so its purpose differs from preview.

## runtimeVersion matches appVersion

Expo config has this setting:

```ts
updates: {
  url: "https://u.expo.dev/<project-id>",
  fallbackToCacheTimeout: 0,
},
runtimeVersion: {
  policy: "appVersion",
},
```

If the app `version` is `1.0.11`, only updates published for that runtime will be delivered. This setting makes it harder to mistakenly deliver new JavaScript to old binaries with different native configurations.

With `fallbackToCacheTimeout: 0`, the app does not wait indefinitely for updates at launch. Updates are applied at the next launch.

## Changes delivered OTA versus changes sent to stores

Only changes that are complete with JavaScript and assets should be published as production updates.

```bash
cd apps/mobile
eas update --channel preview --message "Fix date display"
eas update --channel production --message "Fix date display"
```

The following changes require new binaries:

- Adding or updating native libraries
- Changes to plugins, ios, or android settings in `app.config.ts`
- Expo SDK updates
- App version changes that affect `runtimeVersion`

I do not decide that all dependency changes are OTA-incompatible. Instead, I check whether the package includes native code. If unclear, I route it through a normal build.

## Actual release order

For routine fixes, I follow this sequence:

1. Verify locally and in Expo Go or development build
2. Publish to preview channel
3. Restart internal distribution build and verify
4. Publish the same change to production channel
5. For the next native change, increment version and submit to store

EAS Update speeds up releases but does not eliminate store builds. Channel is the delivery target, runtimeVersion is the compatibility boundary. After defining these two as separate roles, I integrated the update command into operations.

## References

- [Expo: EAS Update](https://docs.expo.dev/eas-update/introduction/)
- [Expo: Runtime versions](https://docs.expo.dev/eas-update/runtime-versions/)
