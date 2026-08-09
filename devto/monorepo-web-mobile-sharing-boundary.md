---
devto_id: 4350880
canonical_url: https://zenn.dev/hirodeath/articles/monorepo-web-mobile-sharing-boundary
title: "How much to share in a monorepo when building common features for web and mobile"
tags: monorepo, nextjs, expo, trpc
published: true
---

This article is an English translation of the original Japanese article.

When I added an Expo app to an existing Next.js web service, I initially wanted to share as much code as possible. In practice, types and business rules share well, while UI and runtime dependencies are easier to manage separately.

SquadNote uses pnpm workspace and Turborepo, composed of `apps/web`, `apps/mobile`, and `packages/*`.

## Current split

```text
apps/
  web/       Next.js, Cloudflare Workers
  mobile/    Expo, React Native
packages/
  api/       tRPC and Zod shared parts
  db/        Drizzle schema
  design-tokens/
```

Root workspace configuration is simple:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

`turbo.json` manages only build and typecheck dependencies. Rather than adding custom build steps for sharing, I started with a structure where each package exports TypeScript sources.

## What I share

The biggest benefit came from tRPC types. Mobile type-imports the web `AppRouter`, using the same input and output.

```ts
import type { AppRouter } from "../../apps/web/src/server/api/root";

export const api = createTRPCReact<AppRouter>();
```

I also separated colors, spacing, and font sizes into `@squadnote/design-tokens`.

```ts
export { colors } from "./colors";
export { spacing } from "./spacing";
export { radius } from "./radius";
```

Business rules like waitlists become sharing candidates as pure functions with no dependency on React or DB. They are easy to test, and results do not diverge between web and mobile.

## What I do not share

I do not share screen components. Next.js DOM and React Native View have different interactions, accessibility, and layout constraints, even when they look similar.

Authentication storage also differs:

- Web: NextAuth cookie session
- Mobile: SecureStore Bearer JWT

Both reach the same API, but sharing the login screen and token storage would require handling each environment's concerns with many branches.

Routing also has separate implementations for Next.js App Router and Expo Router. What I share is the meaning of `organizationId` or `scheduleId`, not a universal function wrapping `router.push`.

## Criteria I use for decisions

Before moving code to packages, I check:

- Does it depend on DOM, React Native, Node, or Cloudflare APIs?
- Do web and mobile have the same reason to change?
- Are branches increasing just to align props?
- Can I verify meaning with unit tests alone?

Business rules and types tend to have the same reason to change. UI, even for the same feature, splits its change reasons by device.

The advantage of a monorepo is not being able to share everything. It is being able to move sharing boundaries later. I implement inside apps first, then extract to packages when specification drift becomes a bigger problem than duplication.
