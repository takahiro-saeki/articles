# Batch 15 mobile fixture

A local reproduction for T29, T32 and T35. It does not contact the real application, read credentials, send notifications or publish an update.

## JavaScript boundary comparisons

Install this directory's dependencies with `npm ci`. From the articles repository root:

```sh
node experiments/article-stock-2026-09/probe-mobile-js-batch15.mjs
```

This executes the installed Router and AppState JavaScript with substituted native boundaries and controlled timer callbacks. The script also reads the badge effect from the fixed circle-hub checkout named in the script. It is not an Android device test or a measurement of native URL timing.

## Local iOS Release comparison

The recorded run used Xcode's installed iOS 26.5 runtime, an iPhone 17 Pro Simulator created only for this experiment, and CocoaPods. The existing user Simulator and physical devices were not used. The app's bundle identifier is `dev.article.startuplab` and its scheme is `articlelab`.

Start the collector from the repository root in a separate terminal:

```sh
node experiments/article-stock-2026-09/collect-mobile-batch15.mjs
```

Inside this fixture directory:

```sh
EXPO_NO_TELEMETRY=1 npx expo prebuild --platform ios --no-install
pod install --project-directory=ios
```

Create a dedicated Simulator using an installed runtime and device type. Use its returned UUID as `ARTICLE_SIMULATOR_ID`. The recorded run used `com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro` and `com.apple.CoreSimulator.SimRuntime.iOS-26-5`. Do not substitute a Simulator containing unrelated work.

```sh
xcrun simctl create 'Article batch15 lab' com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro com.apple.CoreSimulator.SimRuntime.iOS-26-5
```

With `ARTICLE_SIMULATOR_ID` set to the new UUID:

```sh
xcrun simctl boot "$ARTICLE_SIMULATOR_ID"
xcrun simctl bootstatus "$ARTICLE_SIMULATOR_ID" -b
EXPO_NO_TELEMETRY=1 RCT_NO_LAUNCH_PACKAGER=1 xcodebuild \
  -workspace ios/Articlestartuplab.xcworkspace -scheme Articlestartuplab \
  -configuration Release -sdk iphonesimulator \
  -destination "id=$ARTICLE_SIMULATOR_ID" -derivedDataPath ios/article-derived \
  CODE_SIGNING_ALLOWED=NO build
xcrun simctl install "$ARTICLE_SIMULATOR_ID" ios/article-derived/Build/Products/Release-iphonesimulator/Articlestartuplab.app
```

Choose a mode before each fresh launch. The app fetches this local value on startup. The auth endpoint delays its synthetic response by 4000 ms; it does not authenticate a user.

```sh
curl --fail -X POST -H 'Content-Type: application/json' --data '{"mode":"early"}' http://127.0.0.1:9915/mode
xcrun simctl launch --terminate-running-process "$ARTICLE_SIMULATOR_ID" dev.article.startuplab
```

Wait for `content-layout` in the collector output file, then repeat with `coordinated`. Records in `production/2026-09/batch-15/mobile-events.ndjson` may arrive out of order; group by `boot` and sort by `sequence`. Re-running appends new observations; preserve the original evidence separately before repeating.

The recorded run verified font/auth/layout/hide ordering in two Release launches. The Mac was locked, so no visual first-frame check was possible. `simctl openurl` returned success but did not produce a received-URL or new launch trace. Only one background event was recorded after launching Settings; no complete foreground return was observed. Do not report these as successful native link-delivery or full lifecycle trials.

After finishing, shut down and delete only the dedicated Simulator, and stop the collector with Ctrl+C. The generated iOS project and build products are ignored. A compact build summary and raw-log hash are retained in the production evidence directory.
