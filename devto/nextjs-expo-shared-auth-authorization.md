---
devto_id: 4392049
canonical_url: https://zenn.dev/hirodeath/articles/nextjs-expo-shared-auth-authorization
title: "Design evolution toward using the same auth and permission model in Next.js and Expo"
tags: nextjs, expo, nextauth, trpc
published: true
---

This article is an English translation of the original Japanese article.

I added an Expo app to a Next.js service that was running on NextAuth. Web uses cookies, mobile uses Bearer JWT. Authentication methods differ, but the session format and permission checks after entering the API are shared.

It did not start in this form. I went through a structure where mobile directly handled Google auth, then a structure using web auth from an in-app browser, before settling on the current boundary.

## Web kept NextAuth cookies

Existing web uses NextAuth sessions. Replacing this just to add mobile would affect login, account linking, and existing sessions.

So I kept web as is and added a JWT entry point just for mobile.

```text
Web     -> Cookie -> tRPC context
Mobile  -> Bearer JWT -> tRPC context
                        -> same session.user
```

## Mobile goes through web OAuth

From Expo, I use `openAuthSessionAsync` to open web authentication. After OAuth completes, the server goes through a short auth flow to return an app JWT, and the app stores it in `SecureStore`.

```ts
const result = await WebBrowser.openAuthSessionAsync(loginUrl, redirectUrl);
```

API requests put it in the Authorization header.

```ts
async headers() {
  const token = await getToken();
  return token ? { authorization: `Bearer ${token}` } : {};
}
```

## Align to the same user format in tRPC context

The server checks cookie session first, then verifies Bearer JWT if absent.

```ts
const session = await auth();

if (!session?.user) {
  const header = opts.headers.get("authorization");
  if (header?.startsWith("Bearer ")) {
    const result = await verifyJwt(header.slice(7), secret);
    // Read user from DB, shape to match session.user
  }
}
```

JWT contains only user ID. `name`, `email`, `image` are fetched from the DB and shaped to match web `session.user`. This way, code that uses user name in notifications does not need to care about access origin.

## Separate authentication and authorization

Whether logged in is checked in `protectedProcedure`. Operational permissions within organizations are judged by separate authorization helpers.

```ts
await assertMember(ctx, organizationId);
await assertAdminOrOwner(ctx, organizationId);
```

Even if a mobile screen hides a button, API checks are not skipped. Screen permission display is for usability, server authorization is for data protection.

## 401 is handled once on mobile side

When JWT expires, parallel requests may all return 401 at once. If each query handles logout individually, navigation overlaps.

```ts
let isHandlingUnauthorized = false;

async function handleUnauthorized() {
  if (isHandlingUnauthorized) return;
  isHandlingUnauthorized = true;
  await clearAuth();
  router.replace("/login");
}
```

Rather than fully sharing authentication methods, I shared everything after API context. Web and mobile differ in how they hold credentials. On the other hand, the permission model after obtaining user ID is the same. With this boundary, I could add mobile while keeping existing web.
