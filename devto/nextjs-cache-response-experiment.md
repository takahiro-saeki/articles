---
title: "Distinguishing Next.js 16 caches with responses and origin request counts"
published: false
description: "A production experiment separates render memoization, cached data, prerendered routes, and browser navigation reuse."
tags: [nextjs, react, caching, webdev]
canonical_url: "https://zenn.dev/hirodeath/articles/nextjs-cache-response-experiment"
---

When reopening a screen produces the same value, which cache is responsible? The application might reuse a fetch result or a route's output. Going back in the browser might not request the page from the server at all.

This experiment attaches sequence numbers at the data origin to distinguish those cases. Record **how many requests reach the origin and which operation increases that count**, alongside the value on screen.

## Fix the cache model first

The experiment ran on September 11, 2026, with Next.js 16.3.4 and Node.js 24.15.0, using `next build --webpack` and `next start`. It used App Router with `cacheComponents: false` and no React Compiler. The React dependency was 19.2.5; Next.js bundled `19.3.0-canary-cbb046ab-20260731` for its App Router React / React DOM implementation.

The current documentation has a separate guide for the [previous model without Cache Components](https://nextjs.org/docs/app/guides/caching-without-cache-components). The observations apply to this configuration; they do not establish every Next.js application's defaults or behavior with Cache Components enabled.

The traditional names Request Memoization, Data Cache, Full Route Cache, and Router Cache describe different cached objects and lifetimes. This experiment maps those names to observable reuse.

| Name | Reuse distinguished here |
| --- | --- |
| Request Memoization | Deduplicating identical fetches during one React render |
| Data Cache | Reusing fetched data across separate HTTP requests |
| Full Route Cache | Reusing route output produced during a build or other prerendering |
| Router Cache | Reusing previously fetched route information during client navigation |

This is not a claim that the entire system has exactly four caches. The experiment excludes CDN caching, ordinary HTTP caching, and caches at the data origin.

## Return a number that increases on every origin request

A local HTTP server maintains a counter for each path. The first request returns something like `{"key":"memo","count":1}`; the next request reaching the same path increases count. The memo, data, and full cases use different paths so their counts remain independent.

Next.js uses one shared fetch function.

```js
export async function readProbe(key, cache) {
  const response = await fetch(`${process.env.ARTICLE_ORIGIN}/${key}`, { cache });
  if (!response.ok) throw new Error(`Probe status ${response.status}`);
  return response.json();
}
```

Each experiment run builds from an empty `.next` directory to avoid a previous Data Cache. The origin is already running during the build, and build-time requests are recorded. Its counters are not reset afterward, which would make them inconsistent with results already stored in a cache.

The fetch does not use authentication, POST, or AbortSignal. The tested condition is two GET calls with the same URL and options from a React Server Component.

## Separate one render from the next request

The first Page fetches with `no-store`. `connection()` makes the following work happen at request time, separating it from prerendering the whole route. This follows the [connection documentation](https://nextjs.org/docs/app/api-reference/functions/connection).

```jsx
import { connection } from 'next/server';
import { readProbe } from '../../../lib/probe';
export default async function Page() {
  await connection();
  const values = await Promise.all([readProbe('memo', 'no-store'), readProbe('memo', 'no-store')]);
  return <pre id="result">{JSON.stringify(values)}</pre>;
}
```

Each route received three direct HTTP GET requests. The values below show only count from the two returned objects.

| Route configuration | Origin requests during build | Additional origin requests across 3 GETs | Counts in each response |
| --- | ---: | ---: | --- |
| connection + no-store | 0 | 3 | [1,1], [2,2], [3,3] |
| connection + force-cache | 0 | 1 | [1,1], [1,1], [1,1] |
| No connection + force-cache | 1 | 0 | [1,1], [1,1], [1,1] |

Even with `no-store`, both values within a response had the same count. Only one request reached the origin. The count increased on the next HTTP request. That exposes reuse within the render.

Keeping `connection()` but changing the fetch to `force-cache` reused the first request's value on later requests. The build still classified that route as dynamic. Dynamic rendering therefore does not imply that every data fetch returns new data.

## An identical value can also come from reused route output

The final route removes `connection()` and performs the two `force-cache` fetches. This application prerendered it during the build. Its one origin request also happened during the build.

All three responses from `next start` had `x-nextjs-cache: HIT`. The two dynamic routes had no such header, even though the data route reused its fetched result.

An absent header therefore does not show that Data Cache was unused. Likewise, an unchanged count does not prove Full Route Cache was responsible. Combining build classification, response headers, and origin counts distinguishes these cases.

The experiment did not test TTL expiration, revalidation, or sharing across multiple servers. It sent closely spaced requests to one Node process.

## Test browser back navigation separately

The navigation route makes one fetch using `connection()` and `no-store`. Playwright operates its links with `prefetch` disabled.

| Operation | Displayed count | Cumulative origin requests |
| --- | ---: | ---: |
| Open the route directly | 1 | 1 |
| Follow a Link to Home, then go back | 1 | 1 |
| router.refresh() | 2 | 2 |
| Go Home, then follow a Link to the route | 3 | 3 |

Going back did not increase the origin count. A new Link navigation to the same URL did. Describing this as "the second visit is cached" would erase the difference between operations.

`router.refresh()` produced a new value because this route used `no-store`. The [useRouter documentation](https://nextjs.org/docs/app/api-reference/functions/use-router) states that refresh does not invalidate server-side caches. This result does not imply that refreshing a real screen using `force-cache` always produces new data.

## Keep a small record that identifies the cause

The [experiment and runner](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/run-next-batch07.py) store build logs, responses, and origin counts separately. Browser checks used HeadlessChrome 152.0.0.0 and Playwright CLI 0.1.19. No external API or production data was involved.

When a real screen shows an old value, first record whether the operation repeats work within a render, makes another HTTP request, or goes back in the browser. Keeping that condition fixed while observing the origin narrows the investigation before adding `no-store` or `router.refresh()` throughout the application.
