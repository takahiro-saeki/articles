---
title: "Choose between Expo SecureStore and AsyncStorage by secrecy and recovery needs"
published: false
tags: expo, reactnative, storage
canonical_url: null
---

Choosing storage requires separate decisions about confidentiality and recovery. Saving a value in SecureStore does not guarantee that it will remain retrievable through reinstallation or a move to another device.

An authentication token needs both protection and a reauthentication path. Language and display preferences can have defaults. When replacing a storage API, design the recovery behavior separately.

## The documentation and code compared here

The official documentation was checked on September 11, 2026. The [latest SecureStore page](https://docs.expo.dev/versions/latest/sdk/securestore/) recommends ~57.0.3, while the [AsyncStorage usage documentation](https://react-native-async-storage.github.io/3.0/api/usage/) covers the 3.0 series.

The example project is circle-hub at fixed commit `a34608c`. Its [mobile dependency declaration](https://github.com/takahiro-saeki/circle-hub/blob/a34608c611ded6549c1176a7977e68e1bc62a8db/apps/mobile/package.json) specifies Expo ~54.0.33 and expo-secure-store ~15.0.3, with no direct AsyncStorage dependency. Reviewing current APIs does not mean the app has migrated to them.

The [authentication code](https://github.com/takahiro-saeki/circle-hub/blob/a34608c611ded6549c1176a7977e68e1bc62a8db/apps/mobile/src/lib/auth.ts) stores a token and user information in SecureStore. The [language preference code](https://github.com/takahiro-saeki/circle-hub/blob/a34608c611ded6549c1176a7977e68e1bc62a8db/apps/mobile/src/lib/i18n.ts) uses it too. Storing a non-secret preference there is not inherently wrong. The volume of data and its recovery behavior help decide whether adding another store is useful.

## Treat encryption and persistence as separate requirements

The [official AsyncStorage repository](https://github.com/react-native-async-storage/async-storage) describes unencrypted persistent key-value storage. Raw authentication tokens need a store that provides the required confidentiality.

The following SecureStore conditions in the official documentation affect the design.

| Condition | Design consequence |
| --- | --- |
| Uses OS-protected storage | Candidate for small secrets |
| Android uninstall removes stored data | Recovery such as reauthentication is necessary |
| iOS data may survive reinstallation; do not depend on it | Reinstallation is not a reliable complete reset |
| Biometric changes can invalidate protected access | Authenticated storage needs a recovery path |
| Platforms can reject large values | Handle write failures without assuming a universal capacity |

The historical reference to roughly 2048 bytes on some iOS versions is not a fixed limit for every environment. Capacity was not measured here. For Android backups, check the documented exclusion configuration rather than assuming restored SecureStore data can be decrypted with the original key.

## Separate a missing value from an unavailable store

The original getToken returns the result of SecureStore.getItemAsync directly. When a substituted storage layer threw, getToken also rejected. The implementation does not turn every failure into null.

A caller that needs to choose recovery behavior could distinguish the outcomes as follows. This wrapper was written for the article and has not been applied to the original code.

```js
async function readSessionToken(store) {
  try {
    const token = await store.getItemAsync("session_token");
    return token === null
      ? { kind: "missing" }
      : { kind: "value", token };
  } catch {
    return { kind: "unavailable" };
  }
}
```

The Node.js 24.15.0 tests used stores that returned a value, returned null, or threw. They produced value, missing, and unavailable respectively, each with 1 read. These tests did not exercise OS encryption or biometric authentication.

value means only that a string was read. Whether that token remains valid and which identity the server assigns it require separate checks. The unavailable branch does not fall back to writing the same secret into AsyncStorage, because doing so would change the required confidentiality in response to a storage failure.

## Preferences can recover through defaults

The actual language preference implementation falls back to system when the stored value is absent, unsupported, or unreadable. Its recovery differs from a token because a usable default can replace the preference.

For a proposed separation into AsyncStorage, the 3.0 API provides createAsyncStorage to create a storage instance. That does not establish that this version is installed in the app. Check Expo SDK compatibility and use the API of the version actually added.

A migration could read the new store first, import only recognized values from the old store when needed, and remove the old value only after the new write succeeds. Decide how to repeat the migration after a partial failure before running it. No dependency was added and no data was migrated here.

## Do not assume device-only data can be recovered

A language setting can fall back to a default. Authentication can offer login again. Unsent text written by a user, however, may have no source from which to retrieve it after deletion. Decide its synchronization and backup requirements before choosing storage.

This review covered official behavior, existing code, and the wrapper's 3 read outcomes. It did not test device transfer, reinstallation, biometric changes, encryption internals, or capacity on a device. Those device-dependent outcomes still need checks in the intended environment.
