---
title: "Distinguish EAS Build, Submit, and Update by what exists after success"
published: false
tags: expo, reactnative, deployment
canonical_url: null
---

A successful EAS operation means different things depending on the command. Build creates an app binary, Submit sends a binary to a store, and Update publishes JavaScript and assets for compatible installed apps.

Before recording a distribution result, identify what was created and where it was sent. This includes distinguishing iOS submission from public release and checking the effect of an Android submission on its selected track.

## Commands in one project can target different things

Current official documentation was checked on September 11, 2026, and compared with the [mobile scripts](https://github.com/takahiro-saeki/circle-hub/blob/a34608c611ded6549c1176a7977e68e1bc62a8db/apps/mobile/package.json) at circle-hub commit `a34608c`.

The dependency declarations specify Expo ~54.0.33 and expo-updates ~29.0.12. This investigation did not run EAS CLI build, submission, or update commands. It compared current documentation with commands declared in fixed source.

| Operation | Main inputs | What to inspect after success |
| --- | --- | --- |
| Build | Source, dependencies, native configuration, build settings | The generated app binary |
| Submit | A signed store binary and submission settings | Store upload result and subsequent state |
| Update | JavaScript and assets for compatible apps | The published update and its receipt and application by the target app |

Build and Submit can be connected, but every successful Build does not automatically submit its result. Behavior depends on whether auto-submit or a separate submission step is configured.

## For Build, identify where the binary can be installed

The [Expo Build documentation](https://docs.expo.dev/build/introduction/) defines the service around producing app binaries. Development, internal distribution, and store builds have different uses.

This definition in the fixed source requests an iOS Build using the profile named production.

```json
{
  "build:prod": "eas build --profile production --platform ios"
}
```

The string contains neither Submit nor auto-submit. Reading this script alone therefore does not establish that it also submits to a store. Whether another step does so requires further inspection.

The [eas.json file](https://github.com/takahiro-saeki/circle-hub/blob/a34608c611ded6549c1176a7977e68e1bc62a8db/apps/mobile/eas.json) specifies internal distribution for development and preview, with different channels. Inspect the profile contents and resulting artifact instead of inferring distribution from the profile name alone.

Build success establishes the artifact-generation stage. Installation, startup, and required user operations are subsequent checks using that artifact.

## Treat iOS and Android differently after Submit

The [Expo store submission documentation](https://docs.expo.dev/deploy/submit-to-app-stores/) describes sending signed binaries to App Store Connect or Google Play Console. Eligible binaries do not have to originate from EAS Build.

For iOS, processing the upload and making it available through TestFlight are separate from App Store review and public release. Submit success alone should not be recorded as a public release.

For Android, the selected track and releaseStatus affect what happens next. It is also inaccurate to say that Submit always uploads without affecting distribution state. Inspect the submission settings for the app being handled.

This investigation did not retrieve actual store state. It does not infer earlier Build or Submit results, review outcomes, or the current distribution track. The table is not a release history.

## Do not expect Update to replace native configuration

The [Expo Update documentation](https://docs.expo.dev/eas-update/introduction/) covers non-native pieces such as JavaScript, styling, and images. The receiving app needs expo-updates included and appropriately configured.

The fixed source contains update scripts targeting production and preview. Its [app configuration](https://github.com/takahiro-saeki/circle-hub/blob/a34608c611ded6549c1176a7977e68e1bc62a8db/apps/mobile/app.config.ts) uses the appVersion runtimeVersion policy and config plugins including SecureStore and SplashScreen.

A JavaScript wording fix and a native SplashScreen configuration change should not be routed through the same process merely because of their filenames. As the [SplashScreen configuration documentation](https://docs.expo.dev/versions/latest/sdk/splash-screen/) describes, changing settings built into the binary requires a new binary. The conditions for receiving a compatible update also need verification.

Successful publication of an Update does not establish that every target device downloaded and applied it. Record update publication and application by the app separately.

## Name the result before handing work to the next stage

A release record can replace "EAS succeeded" with more specific fields. The following is a proposed record structure, not a table of completed operations.

| Stage | Example result fields | Separate checks that remain |
| --- | --- | --- |
| Build | Target profile, artifact reference | Installation and behavior |
| Submit | Store, uploaded artifact, submission result | Processing, review, track or publication state |
| Update | Target channel, published update reference | Download and application by the target app |

Comparing the fixed scripts with official behavior shows why one success flag for Build, Submit, and Update loses information. Recording the stage actually completed gives the next person an artifact from which to resume verification.

This investigation read Git and evaluated the configuration function. It did not measure build cost, upload time, propagation time, or device reach. Actual distribution records still require verification of the relevant operation and artifact.
