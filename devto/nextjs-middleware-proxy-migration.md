---
title: "Migrating Next.js Middleware to Proxy: verify the matcher and runtime after renaming"
published: false
tags: nextjs, javascript, testing
canonical_url: null
---

After renaming Middleware to Proxy, verify which requests pass through it and which runtime it uses. Next.js 16.3.4's codemod transformed this minimal example, while a comparison version that added a runtime export to Proxy failed to build.

The example adds an observation header to a response. It is not a migration of a real service's authentication flow.

## Why the name changed to Proxy

The [official migration explanation](https://nextjs.org/docs/app/api-reference/file-conventions/proxy#migration-to-proxy) describes avoiding confusion with Express.js middleware and emphasizing the network boundary before a request reaches the application. The change starts with Next.js 16.

The name alone is not a reason to collect every general-purpose operation there. This experiment keeps route handling separate from the header added before proceeding to the route.

## Inspect what the codemod changed

The input `middleware.js` exports a function named `middleware` and uses `/protected/:path*` as its matcher. The `middleware-to-proxy` transform from `@next/codemod` 16.3.4 ran against an experimental copy.

Its resulting `proxy.js` was:

```js
import { NextResponse } from 'next/server';
export function proxy(request) {
  const response = NextResponse.next();
  response.headers.set('x-article-proxy', request.nextUrl.pathname);
  return response;
}
export const config = { matcher: ['/protected/:path*'] };
```

The original file was removed, and the exported function became `proxy`. The header-setting behavior and matcher remained. No login check or redirect was added to this example.

The file sits alongside app. The [record](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/production/2026-09/batch-10/proxy-codemod.json) contains both versions. Application behavior still needs checking after the transformation.

## Verify the matcher with HTTP requests

The transformed code was built for production and served through local `next start`. The route handles GET by returning the path. Header presence was recorded separately from HTTP status.

| Request | Status | x-article-proxy |
| --- | --- | --- |
| GET /protected | 200 | /protected |
| GET /protected/a/b | 200 | /protected/a/b |
| GET /protected?x=1 | 200 | /protected |
| GET /protectedness | 404 | Absent |
| GET / | 200 | Absent |
| GET /plain.png | 200 | Absent |
| POST /protected | 405 | /protected |

Although `/protectedness` starts with similar text, this matcher did not include it. With a query string, the pathname placed in the header remained `/protected`.

POST passed through Proxy but returned 405 because the route had no POST handler. Passing through Proxy and having a route that supports a method are separate observations.

These 7 inputs check the target route and nearby paths. They do not cover every URL, prefetch request, basePath, locale, or rewritten path. Check the [matcher reference](https://nextjs.org/docs/app/api-reference/file-conventions/proxy#matcher), then add requests required by the application.

## What happens if Proxy retains a runtime export?

A separate fixture added `export const runtime = 'edge'` to this Proxy. Its build failed with exit 1. The error stated that Proxy does not allow route segment configuration and runs on the Node.js runtime.

The [Proxy runtime reference](https://nextjs.org/docs/app/api-reference/file-conventions/proxy#runtime) also disallows a runtime option. The rename does not establish that earlier Edge assumptions remain applicable.

This error does not test authentication-library compatibility or real network operations. Code using runtime-specific APIs still needs its transformed build and request handling checked.

The tests ran on September 11, 2026. Next.js and the codemod were 16.3.4, installed React and React DOM were 19.3.0, and Node.js was 24.15.0 on macOS arm64. The fixture used a webpack production build, `cacheComponents: false`, no React Compiler, and a local Node server. The [runner](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/run-next-batch10.py) and [HTTP results](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/production/2026-09/batch-10/proxy-http-results.json) are available. No cloud deployment or real application migration was performed.
