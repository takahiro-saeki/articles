---
title: The stack I use to run two indie web and iOS apps
tags: nextjs, expo, cloudflare, trpc
published: false
---

_This article is an English translation of the original Japanese article._

I develop and operate two services by myself, each with a web app and an iOS app. One manages community group activities, while the other records voice training.

The second project could reuse parts of the first. Authentication and deployment still need project-specific work, but fewer decisions start from zero. This article lists the current stack by layer, including the parts I have not fully cleaned up.

## Overall structure

```
├── apps/
│   ├── web/      Next.js 15 (App Router) + React 19
│   └── mobile/   Expo SDK 54 (React Native 0.81)
└── packages/
    ├── api/            shared tRPC AppRouter type
    └── design-tokens/  color, spacing, and font constants
```

- Monorepo: Turborepo and pnpm workspace
- API: tRPC v11, with the router implementation in Next.js and only its types shared with mobile
- Authentication: NextAuth v5 beta, with a JWT bridge for mobile
- Database: Drizzle ORM and Cloudflare D1
- Web UI: Tailwind CSS v4, a shadcn/ui-style component layer, and Base UI (`@base-ui/react`)
- Mobile UI: React Native `StyleSheet` and shared design tokens
- Tests: Vitest for unit tests and Storybook browser mode tests
- Infrastructure: Cloudflare Workers through `@opennextjs/cloudflare`

## API: remove duplicate types with tRPC v11

I do not run a separate API server. The Expo app calls the Next.js `/api/trpc` endpoint. `packages/api` is a small package that re-exports the router type. Some parts of the codebase still import `AppRouter` directly from the web app, so the package boundary is not completely settled, but the type-sharing direction is consistent.

The reason for choosing tRPC is simple. When one person writes both the web and mobile apps, maintaining API types in two places wastes time. I also considered REST with OpenAPI generation, but avoiding a generation step made tRPC a better fit for these projects.

## Authentication: NextAuth v5 on web and JWT on mobile

The web app uses NextAuth cookie sessions with Google and Apple OAuth. Cookies are awkward on mobile, so the server issues a JWT after OAuth completes. Expo stores it in SecureStore and sends it in a Bearer header. The server context accepts either a cookie session or a Bearer token.

This was the part of the stack that took the most design work. Once the bridge was in place, the rest of the mobile API integration was much more direct.

## Database: Drizzle and D1

The database is Cloudflare D1, which is SQLite-compatible, and the ORM is Drizzle. I like this combination for two reasons:

- Drizzle relational queries make it easier to build SQL that fetches related records together.
- drizzle-kit migrations fit D1's migration flow. I can apply the same SQL locally and in production.

D1 also has constraints. It does not expose interactive transactions, so multiple statements use `batch()`. Some PRAGMAs are unavailable as well. These differences matter if you approach it like a local SQLite connection, but they have not blocked the CRUD-heavy features in these apps.

## UI: Tailwind and Base UI on web, shared tokens across platforms

The main web app has a shadcn/ui-style setup. Components live in my repository, cva manages variants, and Base UI provides the primitives. The other app uses a simpler setup centered on plain Tailwind. I adjust the UI layer to the size of each project.

The web and mobile apps share semantic names for colors, spacing, and fonts. Mobile imports the tokens directly into `StyleSheet`, while web repeats the same values as CSS variables. The web values are synchronized manually, so this is not a perfect single source of truth, but it removes many one-off color choices.

## Tests: stories double as tests

Vitest handles logic-level unit tests. Storybook stories also run as browser mode tests in real Chromium. Writing a component catalog and writing a component test become the same task, which makes the test suite grow more naturally in a one-person project.

## Infrastructure: mostly Cloudflare

- Next.js deploys to Workers through `@opennextjs/cloudflare`.
- D1 stores application data, and Workers serves static assets.
- Production and development use separate deployments and separate D1 databases.

I chose this setup for cost and low operational overhead. Current usage fits within the free tiers for Workers and D1, and I do not manage a server.

Deployment is one command chain:

```bash
opennextjs-cloudflare build && wrangler deploy
```

The mobile app follows the standard Expo build and App Store submission flow.

## Weak points in the stack

- NextAuth v5 is still beta, so I accept the risk of breaking changes.
- D1 has less community material than older databases. When search results are thin, I read the official documentation and source.
- Mobile store review cannot be removed by a stack choice. Web changes deploy immediately, while app releases require review, so the API needs backward compatibility.

## Reuse matters more on the second project

I did not evaluate this stack only by how fast it built the first project. I cared about how much could carry into the second one. The monorepo structure, authentication bridge, design tokens, and deployment procedure all became reusable starting points. That let the second project begin with its product-specific features instead of another round of infrastructure selection.

I have separate articles that go deeper into tRPC type sharing, D1 migration, and Base UI.

## Environment

- Turborepo, pnpm, Next.js 15, React 19, Expo SDK 54, and React Native 0.81
- tRPC v11, TanStack Query v5, superjson, NextAuth v5 beta, and jose
- Drizzle ORM 0.41, Cloudflare D1, Tailwind CSS v4, `@base-ui/react`, and cva
- Vitest, Storybook with nextjs-vite, Playwright, `@opennextjs/cloudflare`, and Wrangler
