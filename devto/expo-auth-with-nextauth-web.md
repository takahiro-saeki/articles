---
title: Adding Expo authentication to a NextAuth-based web service
tags: expo, nextauth, reactnative, jwt
published: false
---

_This article is an English translation of the original Japanese article._

I added an Expo app to an existing Next.js web service that already used NextAuth, now Auth.js, for authentication. NextAuth assumes a cookie-based session, which does not fit a mobile app particularly well.

Replacing the authentication platform was one option. Instead, I kept NextAuth on the web and added a JWT issuing endpoint for mobile. This article records the structure I use in a live service and the problems that remain. It is not a finished authentication blueprint.

## Overall flow

There are three parts:

- Web, built with Next.js: NextAuth with Google and Apple OAuth, using a cookie session
- Mobile, built with Expo: a Bearer JWT rather than cookies
- Bridge: run the web OAuth flow in an in-app browser and return a JWT to the app when it completes

```
Mobile app                Web (Next.js)
  │ openAuthSessionAsync     │
  ├────────────────────────→ │ /api/auth/mobile-callback?action=login&redirect=exp://...
  │                          │   → NextAuth sign-in → Google OAuth
  │                          │   → OAuth completes and cookie session is created
  │                          │   → issue JWT
  │ ←──────────────────────  │   → redirect to exp://...?token=xxx
  │ save token in SecureStore│
  │                          │
  │ Later API calls: Authorization: Bearer xxx
```

## Mobile: use `openAuthSessionAsync` as the bridge

The Expo login button only needs to open the web login flow with `expo-web-browser`.

```tsx
import * as WebBrowser from "expo-web-browser";

const redirectUrl = Linking.createURL("/login"); // exp:// or squadnote://
const loginUrl = `${config.apiUrl}/api/auth/mobile-callback?action=login&redirect=${encodeURIComponent(redirectUrl)}`;

const result = await WebBrowser.openAuthSessionAsync(loginUrl, redirectUrl);
// result.url contains exp://...?token=xxx
```

`openAuthSessionAsync` opens a browser session for authentication and returns to the app when a redirect to the requested scheme occurs. That makes it a practical bridge for the OAuth flow.

I store the returned token with `expo-secure-store`.

```ts
import * as SecureStore from "expo-secure-store";

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync("squadnote_jwt", token);
}
```

## Server: let `mobile-callback` issue the JWT

I added a mobile-specific callback Route Handler to the web app. It does three things:

1. On `?action=login`, save the mobile redirect target in a cookie and continue to NextAuth sign-in.
2. After OAuth returns, call `auth()` to identify the user from the new cookie session.
3. Issue a JWT and redirect to the mobile scheme with `?token=xxx`.

```ts
// /api/auth/mobile-callback, shortened
export async function GET(request: Request) {
  const session = await auth(); // Cookie session exists after OAuth
  if (!session?.user?.id) { /* continue to sign-in */ }

  const token = await signJwt(session.user.id, secret); // signed with jose
  return NextResponse.redirect(`${mobileRedirect}?token=${token}`);
}
```

### Redirect validation and its limitations

If the `redirect` parameter accepts any URL, the server could send the JWT somewhere unintended. My current implementation limits redirects to schemes used by the app.

```ts
// Allow Expo development schemes or the production custom scheme
function isAllowedMobileRedirect(redirect: string): boolean {
  return (
    redirect.startsWith("exp://") ||
    redirect.startsWith("exps://") ||
    redirect.startsWith("squadnote://")
  );
}
```

I do not consider this prefix check sufficient. Parsing the URL and validating the host and path as well as the scheme would be safer. The development `exp://` allowance is broad, so production should accept only a fixed callback under the custom scheme.

The other problem is placing the JWT itself in the redirect URL. Expo AuthSession can receive an authorization code instead. I plan to return a short-lived code to the app and exchange it for a JWT on the server. I would not use the current code unchanged as an authentication template.

## Let the API accept cookies and Bearer tokens

The tRPC or API context first checks the cookie session. If no session exists, it falls back to a Bearer token.

```ts
// tRPC context, shortened
// Web: cookie session / Mobile: Authorization: Bearer <JWT>
const session = await auth();
if (!session) {
  const authHeader = opts.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const payload = await verifyJwt(authHeader.slice(7), secret);
    // Build a session-like value from the user ID in payload
  }
}
```

Web and mobile can then call the same procedures. The mobile tRPC client adds the token in its `headers()` callback for every request. The authentication paths differ, but authorization stays shared at the procedure layer.

## Two operational pieces worth adding early

The first is automatic logout on 401. Tokens eventually expire. Wrapping `fetch` so it deletes the token and returns to the login screen avoids adding the same error handling to every screen.

```ts
const authAwareFetch: typeof fetch = async (input, init) => {
  const response = await fetch(input, init);
  if (response.status === 401) void handleUnauthorized();
  return response;
};
```

Apple sign-in uses a separate native path through `expo-apple-authentication`. The app posts the native credential to the server, which verifies it and returns the same JWT format. Token storage and subsequent API calls are shared with the browser-based path.

## Tradeoffs in the current design

- JWT revocation relies only on expiration. Immediate remote logout would require storing token state in the database or adding a version number.
- I left NextAuth's session strategy and callbacks alone, so the web authentication path did not need to change. Preserving the working web login was the main constraint.

This structure let me add the app without replacing the existing web authentication. The JWT in the redirect URL and the redirect validation still need work. I found it useful to separate the structure needed to get the app running from the security work required before treating it as a reusable design.

## Environment

- Expo SDK 54 with expo-web-browser, expo-secure-store, and expo-apple-authentication
- Next.js 15, NextAuth v5 beta, jose, and tRPC v11
- The code is shortened from a service in production
