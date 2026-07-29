---
devto_id: 4263611
title: "Sharing tRPC v11 types between Next.js and Expo: a real-world indie Web + iOS setup"
tags: trpc, nextjs, expo, typescript
canonical_url: https://zenn.dev/hirodeath/articles/trpc-share-types-next-expo
published: true
---

> This is a translation of my original article in Japanese: [Zenn](https://zenn.dev/hirodeath/articles/trpc-share-types-next-expo)

I build and run a service as a solo developer that ships both a web app (Next.js) and an iOS app (Expo / React Native). The one thing I wanted to avoid most in this setup was maintaining API type definitions in two places. Hand-editing the app-side types every time a server response changes is a workflow that reliably falls apart when you are a one-person team.

Combine tRPC v11 with a monorepo and the API types you write on the Next.js side flow straight into Expo's autocomplete. Add a field to a server procedure and the app code immediately shows a type error. This post walks through the actual setup of my service (a sports club management app).

## The big picture

It is a Turborepo monorepo laid out like this:

```
├── apps/
│   ├── web/      ← Next.js 15. The tRPC router lives here
│   └── mobile/   ← Expo. Connects as a tRPC client
└── packages/
    ├── api/      ← A package that only re-exports the AppRouter type
    └── design-tokens/
```

The key decision: the tRPC router implementation stays inside Next.js. I did not split the API out into a separate server app. The web app keeps serving `/api/trpc` as before, and the mobile app calls that endpoint from outside. One less server to deploy, and no extra infrastructure cost.

## packages/api is a types-only package

The contents of `packages/api` are essentially this:

```ts
// packages/api/src/index.ts
export type { AppRouter } from "../../apps/web/src/server/api/root";
export type { RouterInputs, RouterOutputs } from "../../apps/web/src/trpc/react";
```

Instead of moving the router definition into the package, it re-exports only the types. Because these are `export type` statements, no server code leaks into the mobile bundle. The package is referenced only at type-check time.

I did consider moving the router definition itself into packages, but that would drag along a pile of Next.js-side dependencies like the DB client and auth. So I started with type sharing only, left a comment in the package saying the router might move there someday, and postponed the decision. It has not been a problem so far.

## The mobile client

On the Expo side, passing the AppRouter type to `createTRPCReact` gives you hooks with the same ergonomics as the web:

```ts
// apps/mobile/src/lib/trpc.ts
import { createTRPCReact, httpBatchLink } from "@trpc/react-query";
import superjson from "superjson";
import type { AppRouter } from "@squadnote/api";

export const api = createTRPCReact<AppRouter>();

export function createTrpcClient() {
  return api.createClient({
    links: [
      httpBatchLink({
        url: config.trpcUrl, // points to /api/trpc on the Next.js app
        transformer: superjson,
        async headers() {
          const token = await getToken(); // from SecureStore
          return token ? { authorization: `Bearer ${token}` } : {};
        },
      }),
    ],
  });
}
```

Screens can now call `api.schedule.list.useQuery(...)` with fully typed inputs and outputs. Change a procedure on the server in a way that breaks an app-side call site and the red squiggles appear right there. Once you have experienced this, going back to REST plus hand-written types is hard.

One rule: the superjson transformer must match on both server and client. If they drift apart, you get accidents like Dates arriving as strings.

## Auth is where web and mobile diverge

More than the type sharing itself, this is where the actual design work went. Web auth runs on NextAuth session cookies, but mobile apps and cookie-based auth do not get along well.

So the mobile app gets its own token-based entrance:

- On login, the server issues a mobile JWT, which Expo stores in `expo-secure-store`
- The tRPC client's `headers()` attaches `Authorization: Bearer` to every request
- The server-side tRPC context accepts either a cookie session or a Bearer token

There is one more mobile-specific piece: automatic logout on 401. I wrap fetch so that when a 401 comes back, the token is discarded and the user is returned to the login screen.

```ts
const authAwareFetch: typeof fetch = async (input, init) => {
  const response = await fetch(input, init);
  if (response.status === 401) {
    void handleUnauthorized(); // discard token → back to /login
  }
  return response;
};
```

Token expiry will happen eventually, so building this first means you never have to write per-screen error handling for it.

## Lessons from running this in production

**Be careful with breaking changes to published procedures.** Deploying the web app updates every user at once, but mobile releases go through store review and each user's update timing, so old app versions keep calling your API for a while. Deleting a procedure or changing its input shape is not something type errors can protect you from, because the old binaries live outside your type checker. Keep backward compatibility, or make handlers tolerant. A monorepo with shared types makes everything feel synchronized, but what is actually running out there is a snapshot of the past.

**RouterInputs / RouterOutputs are quietly great.** These utility types let you extract a procedure's input and output types, so you never hand-write "the item type of this list" on the screen side:

```ts
import type { RouterOutputs } from "@squadnote/api";
type Schedule = RouterOutputs["schedule"]["list"][number];
```

## Closing

With this setup, "the API and the app types drifted apart" turns from a runtime bug into a compile-time error. For one person running both web and iOS, deleting an entire genre of bugs that you would otherwise only find by running the app is a big deal. The only real design decision left in the API layer is where the router lives; tRPC takes care of the rest.

I hope this helps anyone considering an indie web + mobile project.

## Environment

- tRPC v11 / @trpc/react-query + TanStack Query v5 / superjson
- Next.js 15 (App Router) + Expo SDK 54 (React Native 0.81)
- Turborepo + pnpm workspace
- I run two web + iOS services on this same architecture. Code samples are simplified from the real thing
