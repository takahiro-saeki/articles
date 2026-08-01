---
devto_id: 4284575
title: How I Fixed an Expo SDK 54 Android Build with SDK 55 Packages Mixed In
tags: expo, reactnative, android, eas
canonical_url: https://qiita.com/hiro123/items/c6e645cc27c4e2a6f919
published: true
---

> This is an English translation of my original article on [Qiita](https://qiita.com/hiro123/items/c6e645cc27c4e2a6f919).

An Android build failed in an Expo SDK 54 app. The project still used Expo SDK 54, but several Expo packages had been upgraded to versions intended for SDK 55.

TypeScript checks passed, and the development server ran normally. I did not catch the mismatch until EAS Build reached the native build step.

## What the dependency list looked like

The relevant part of `package.json` looked like this:

```json
{
  "dependencies": {
    "expo": "~54.0.33",
    "expo-apple-authentication": "~55.0.13",
    "expo-dev-client": "^55.0.27",
    "expo-image-picker": "^55.0.18",
    "expo-linking": "^55.0.12",
    "expo-notifications": "^55.0.19",
    "expo-splash-screen": "^55.0.18"
  }
}
```

The `expo` package was still on version 54, while several related packages were on version 55. This happened because those packages had been installed individually using their latest versions.

The package version does not always match the Expo SDK number. For example, Expo SDK 54 uses `expo-notifications` 0.32 and `expo-splash-screen` 31. Looking only at major version numbers is not enough to determine SDK compatibility.

## Start with `expo install --check`

Expo CLI can compare the installed packages with the versions expected by the current SDK:

```bash
npx expo install --check
```

It can also return the result as JSON:

```bash
npx expo install --check --json
```

This is more reliable than trying to infer compatibility from `package.json` manually.

Expo CLI can fix the versions automatically:

```bash
npx expo install --fix
npx expo-doctor
```

I wanted to review each change, so I used the reported versions to update `package.json` myself.

## The versions I changed

These were the main corrections:

```diff
- "expo-apple-authentication": "~55.0.13"
+ "expo-apple-authentication": "~8.0.8"

- "expo-dev-client": "^55.0.27"
+ "expo-dev-client": "~6.0.21"

- "expo-image-picker": "^55.0.18"
+ "expo-image-picker": "~17.0.11"

- "expo-linking": "^55.0.12"
+ "expo-linking": "~8.0.12"

- "expo-notifications": "^55.0.19"
+ "expo-notifications": "~0.32.17"

- "expo-splash-screen": "^55.0.18"
+ "expo-splash-screen": "~31.0.13"
```

After updating the lockfile, I ran the checks again:

```bash
pnpm install
pnpm --filter @squadnote/mobile exec expo install --check
pnpm --filter @squadnote/mobile exec expo-doctor
```

In a monorepo, it is worth running the command against the intended app package. Otherwise, the command may inspect a different `package.json` from the one used by the mobile build.

## Why TypeScript did not catch it

Some packages from a different SDK can still expose JavaScript APIs and type definitions that satisfy the application code. EAS Build also has to assemble config plugins and native modules for Android and iOS.

The mismatch was in the native package combination, not in the TypeScript surface. A passing `tsc` run does not confirm Expo SDK compatibility.

## Preventing the same problem

I now use `expo install` when adding Expo-managed packages:

```bash
npx expo install expo-notifications
```

This selects a version compatible with the SDK currently installed in the project. After an SDK upgrade, I run these checks before starting an EAS Build:

```bash
npx expo install --check
npx expo-doctor
```

In this case, the SDK upgrade itself was not the problem. SDK 55 package versions had been added to a project that still used SDK 54. Expo CLI found the mismatch faster and more accurately than checking version numbers by eye.

## References

- [Expo: Upgrade Expo SDK](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/)
- [Expo CLI: Version validation](https://docs.expo.dev/more/expo-cli/)
