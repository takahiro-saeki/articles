---
devto_id: 4316423
canonical_url: https://qiita.com/hiro123/items/a229ae95d7686b70ec90
title: Opening Web Invite Links Directly in the App with Expo Router
tags: Expo, Expo Router, Universal Links, React Native
published: true
---

This article is an English translation of the original Japanese article.

In my club management app, I use the following invite URL for both web and iOS app:

```text
https://squad-note.com/invite/{orgId}
```

If the app is installed, Expo Router opens the invite screen in the app. If not, the web page displays. Using Universal Links lets me share a single URL rather than splitting it into web and app versions.

## Expo Router File Structure

I place the invite screen as a dynamic route.

```text
apps/mobile/src/app/invite/[orgId]/index.tsx
```

The screen retrieves the `orgId` from the URL via `useLocalSearchParams`.

```tsx
import { useLocalSearchParams, useRouter } from "expo-router";

export default function InviteScreen() {
  const { orgId } = useLocalSearchParams<{ orgId: string }>();
  const router = useRouter();

  const { data: org, isLoading } = api.organization.getPublic.useQuery(
    { id: orgId! },
    { enabled: !!orgId },
  );

  // Display invite content and execute join process
}
```

When opened with `/invite/abc`, `orgId` receives `abc`. I also provide a page with the same path on the web side.

## Setting a Custom Scheme

To handle app-specific URLs, I set a scheme in the Expo config.

```ts
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  scheme: "squadnote",
});
```

This allows handling URLs like the following during development and authentication callbacks:

```text
squadnote://invite/abc
```

However, I use HTTPS for the invite URLs shared with users. Because custom schemes can be declared by different apps with the same scheme, I use Universal Links as the entry point to securely associate normal web URLs with the app.

## iOS Associated Domains

In `app.config.ts`, I separate domains for production and development.

```ts
ios: {
  bundleIdentifier: IS_PROD
    ? "com.squadnote.app"
    : "com.squadnote.app.dev",
  associatedDomains: IS_PROD
    ? ["applinks:squad-note.com"]
    : ["applinks:dev.squad-note.com"],
}
```

Adding the configuration alone does not make it work. I also serve `apple-app-site-association` from the web domain.

```text
https://squad-note.com/.well-known/apple-app-site-association
```

On the Next.js side, I placed it as a Route Handler.

```text
apps/web/src/app/.well-known/apple-app-site-association/route.ts
```

The response defines the `appID` combining the Apple Developer Team ID and Bundle ID, and the paths the app should open. To target only the invite link, I can narrow the range to `/invite/*`.

## Shared URL

On the mobile side, I also share the HTTPS URL.

```ts
const inviteUrl = `${config.apiUrl}/invite/${id}?openExternalBrowser=1`;

await Share.share({
  message: `Invitation to ${orgName}\n${inviteUrl}`,
});
```

On iOS devices with the app installed, it opens the app as a Universal Link. Otherwise, it opens the web invite page.

`openExternalBrowser=1` is a parameter used on the web side for LINE's in-app browser. It is a separate issue from the Universal Links configuration, so I treat app association and web browser workarounds as separate concerns.

## Verification Considerations

Universal Links work with the combination of an installed app, the domain's AASA, and a signed build. Using only Expo Go does not provide the same verification as production.

I verify the following separately:

- Tap URLs in messages with a TestFlight build installed
- Open the same URL with the app deleted
- Confirm production and dev domains are not confused
- Confirm the AASA URL returns JSON without redirects
- Test with users already in the organization and non-members

With Expo Router, paths and file structure correspond, so creating the invite screen inside the app was simple. The time-consuming part was not the app, but associating the domain with iOS.

## References

- [Expo Router: Link to your app](https://docs.expo.dev/linking/overview/)
- [Expo Router: Typed routes](https://docs.expo.dev/router/reference/typed-routes/)
