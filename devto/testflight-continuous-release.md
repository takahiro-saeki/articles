---
devto_id: 4407119
canonical_url: https://zenn.dev/hirodeath/articles/testflight-continuous-release
title: "Release process for continuously delivering a personal dev app to TestFlight"
tags: expo, eas, testflight, ios
published: true
---

This article is an English translation of the original Japanese article.

In personal development, you cannot always ship the next build while the release procedure is still fresh. If weeks pass, you end up researching the difference between version and build number, certificates, and the boundary with EAS Update again.

SquadNote uses EAS Build and EAS Submit, separating changes that require store submission from changes deliverable via OTA.

## Separate version and build number

Expo config holds the user-visible version:

```ts
export default {
  version: "1.0.11",
  ios: {
    bundleIdentifier: "com.squadnote.app",
    buildNumber: "2",
  },
};
```

On the EAS side, `appVersionSource` is remote, and production build has `autoIncrement: true`.

```json
{
  "cli": {
    "appVersionSource": "remote"
  },
  "build": {
    "production": {
      "autoIncrement": true,
      "channel": "production"
    }
  }
}
```

When recreating a TestFlight build with the same version, build number cannot duplicate. Delegating to automatic numbering reduces number corrections right before submission.

## Determine change type before release

If only JavaScript and images changed, you can use EAS Update. If you changed native libraries, Expo SDK, plugins, or iOS settings, you need a new build.

When shipping a new binary, decide the version and check:

- `expo install --check` and `expo-doctor`
- TypeScript and tests
- Production API URL
- Expo config such as Universal Links or permission strings
- Login, notifications, main screens on device

## production build and submit

Run the build from the mobile package:

```bash
cd apps/mobile
eas build --platform ios --profile production
```

Send the completed build to TestFlight:

```bash
eas submit --platform ios --profile production --latest
```

The submit profile in `eas.json` has App Store Connect App ID and Team ID. Credentials themselves are not in the repository.

## What to verify in TestFlight

Even if a development build works, some features can only be verified with production signing and production domain. I verify Universal Links, Sign in with Apple, and push notifications in the TestFlight build.

After verification, minor JS fixes to the same version can be delivered OTA to the production channel. When native changes enter, move to the next version.

## Leave procedure in commits

At release time, I make the version update an independent commit. This makes it easier to trace which code was submitted to TestFlight from Git history.

What helped most for continuous delivery was fixing decision criteria rather than the amount of automation. If you have decided whether OTA is acceptable, whether a binary is needed, and what to verify in TestFlight, you can return to the procedure even after a long gap.

## References

- [Expo: Build for app stores](https://docs.expo.dev/deploy/build-project/)
- [Expo: Submit to app stores](https://docs.expo.dev/submit/introduction/)
