---
title: Three problems I hit deploying Next.js 16 to Cloudflare Workers with OpenNext
tags: nextjs, cloudflare, workers, opennext
published: false
---

_This article is an English translation of the original Japanese article._

I deployed a Next.js application with App Router, API routes, and D1 to Cloudflare Workers through `@opennextjs/cloudflare`. The basic process followed the official documentation, but I ran into three problems that were not covered there. This article records the errors and the fixes.

The basic deployment flow looks like this:

```bash
npm i @opennextjs/cloudflare@latest
npm i -D wrangler@latest
# Add wrangler.jsonc and open-next.config.ts
npx opennextjs-cloudflare build
npx opennextjs-cloudflare deploy
```

## Problem 1: Next.js 16.2.10 fails the peer dependency check

Installing `@opennextjs/cloudflare` immediately failed with a peer dependency error.

```
npm error Could not resolve dependency:
npm error peer next@">=15.5.21 <16 || >=16.2.11" from @opennextjs/cloudflare@1.20.2
```

The project used Next.js 16.2.10, while the adapter required 16.2.11 or newer for the 16.x line. The project missed the accepted range by one patch version.

The fix was a Next.js patch update.

```bash
npm i next@16.2 eslint-config-next@16.2
```

`--legacy-peer-deps` could force the installation, but I saw no reason to keep a version that the adapter explicitly excludes.

## Problem 2: generated Wrangler types collide with DOM types

I ran `wrangler types` to add types for the D1 binding. TypeScript errors then appeared throughout the application.

```
error TS18046: 'body' is of type 'unknown'.
error TS2339: Property 'name' does not exist on type 'object'.
```

The generated `worker-configuration.d.ts` includes global Workers runtime types such as `Request`, `Response`, and `Body`. Those names overlap with the DOM types expected by Next.js. Once both sets of globals entered the same project, `request.json()` returned `unknown` instead of the DOM definition's type.

I cover the details in a separate article. The short version is to stop generating the full runtime definitions and write a small declaration file that imports only the required binding types.

```ts
// cloudflare-env.d.ts, written manually
import type { D1Database, Fetcher } from "@cloudflare/workers-types";

declare global {
  interface CloudflareEnv {
    DB: D1Database;
    ASSETS: Fetcher;
  }
}

export {};
```

## Problem 3: a temporary 404 with error code 1042 after deployment

The deploy command succeeded and printed the URL, but the first curl request returned a 404. The response body contained only this Cloudflare error:

```
error code: 1042
```

Error 1042 normally means that a Worker tried to make a subrequest to its own hostname. For a moment, I suspected that OpenNext asset loading was broken.

In this deployment, all routes returned 200 after a short wait and the error did not return. I also observed a period where a HEAD request returned 200 while GET returned 404. Error 1042 is still a real subrequest error, so a persistent failure requires checking Worker routes and request targets.

If it happens only immediately after deployment, retrying after one or two minutes is worth doing. If it continues, do not assume propagation is the cause.

## Additional notes

- `wrangler.jsonc` needs the `nodejs_compat` compatibility flag for OpenNext.
- For local testing, building first and then running `wrangler dev` reproduced the Workers runtime more directly than `opennextjs-cloudflare preview` in my setup.
- With D1, adding `initOpenNextCloudflareForDev()` to `next.config.ts` lets `next dev` use local D1 and keeps development and production code paths closer.

## Summary

| Problem | Symptom | Fix |
|---|---|---|
| Peer dependency | Next.js 16.2.10 is excluded | Update to Next.js 16.2.11 or newer |
| `wrangler types` | `json()` becomes `unknown` | Use a handwritten declaration file with `import type` |
| Error 1042 | Temporary 404 after deployment | Retry, then inspect routing if it persists |

Each problem has a small fix once identified, but the first error message does not always point to the correct layer.

## Environment

- Next.js 16.2, `@opennextjs/cloudflare` 1.20, and Wrangler 4.113
- Cloudflare Workers and D1
