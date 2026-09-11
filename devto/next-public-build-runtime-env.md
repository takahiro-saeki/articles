---
title: "Do NEXT_PUBLIC values change at startup? Run one Next.js build with two environments"
published: false
tags: nextjs, javascript, testing
canonical_url: null
---

Changing a `NEXT_PUBLIC_` value and restarting the server left this browser display at its build-time value. A dynamically rendered Server Component, however, read the server-only value supplied at startup.

With `process.env`, the time at which a value is determined matters. One Next.js 16.3.4 build was started under two different environments.

## Give build and startup different values

Every value is a synthetic string that is safe to display:

| Phase | ARTICLE_SERVER_LABEL | NEXT_PUBLIC_ARTICLE_LABEL |
| --- | --- | --- |
| Build | server-build-A | public-build-A |
| Startup B | server-runtime-B | public-runtime-B |
| Startup C | server-runtime-C | public-runtime-C |

B was stopped before starting C, with no rebuild between them. Their BUILD_ID values matched. This is not a test of `.env` precedence; values were passed explicitly to the processes.

The [environment-variable documentation](https://nextjs.org/docs/app/guides/environment-variables#bundling-environment-variables-for-the-browser) describes inlining directly referenced public values during the build and freezing them afterward. Here, only the startup environment changed after building.

## Static Server Components retained the generated values

The first page does not request dynamic rendering:

```jsx
export default function Page() {
  return <pre id="env-result">{JSON.stringify({
    server: process.env.ARTICLE_SERVER_LABEL,
    public: process.env.NEXT_PUBLIC_ARTICLE_LABEL,
  })}</pre>;
}
```

The build prerendered this page. Under both B and C, server remained `server-build-A` and public remained `public-build-A`. A server-only variable read during the build and rendered into HTML stays in that generated output.

The comparison page awaits `connection()` before reading:

```jsx
import { connection } from 'next/server';
export default async function Page() {
  await connection();
  return <pre id="env-result">{JSON.stringify({
    server: process.env.ARTICLE_SERVER_LABEL,
    public: process.env.NEXT_PUBLIC_ARTICLE_LABEL,
  })}</pre>;
}
```

Its server value became `server-runtime-B` under B and `server-runtime-C` under C. Public remained `public-build-A` in both.

| Display location | Server under B | Server under C | Public under both startups |
| --- | --- | --- | --- |
| Prerendered page | server-build-A | server-build-A | public-build-A |
| Page reading after connection | server-runtime-B | server-runtime-C | public-build-A |

The [runtime-variable explanation](https://nextjs.org/docs/app/guides/environment-variables#runtime-environment-variables) also describes reading values during dynamic server rendering.

The code intentionally displays the server value for observation. Omitting `NEXT_PUBLIC_` does not keep a value secret after code explicitly places it in JSX or a response. No real secrets were used.

## Change the access form inside the browser

The Client Component reads inside useEffect to separate browser execution from initial server rendering. Missing values become null instead of disappearing from the result JSON.

```jsx
'use client';
import { useEffect, useState } from 'react';
export default function Page() {
  const [values, setValues] = useState(null);
  useEffect(() => {
    const key = 'NEXT_PUBLIC_ARTICLE_LABEL';
    const env = process.env;
    setValues({ direct: process.env.NEXT_PUBLIC_ARTICLE_LABEL,
      dynamic: process.env[key] ?? null, alias: env.NEXT_PUBLIC_ARTICLE_LABEL ?? null,
      server: process.env.ARTICLE_SERVER_LABEL ?? null });
  }, []);
  return <pre id="env-result">{JSON.stringify(values)}</pre>;
}
```

A real browser supplied the displayed values after useEffect:

| Access form | Startup B | Startup C |
| --- | --- | --- |
| process.env.NEXT_PUBLIC_ARTICLE_LABEL | public-build-A | public-build-A |
| process.env[key] | null | null |
| env.NEXT_PUBLIC_ARTICLE_LABEL | public-build-A | public-build-A |
| process.env.ARTICLE_SERVER_LABEL | null | null |

Indirect accesses did not all behave identically. The official page gives variable-key and aliased-process.env examples as accesses that are not inlined. Yet this version and source produced `public-build-A` for the alias.

The emitted browser chunk was inspected too. Both `direct` and `alias` contained the string literal `"public-build-A"`; `dynamic` retained an expression reading the browser-side env. The [generated-code record](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/production/2026-09/batch-10/client-bundle-evidence.json) captures this. The experiment did not identify which internal optimization performed the transformation.

What it did establish is that these forms did not deliver `public-runtime-B` or `public-runtime-C` to the browser. An alias or dynamic key should not substitute for an explicit runtime-configuration delivery mechanism.

## Decide where configuration enters a shared build

Directly referenced public values were fixed during this build. Server-only values could be read during dynamic rendering, but the browser did not automatically receive startup configuration through these accesses.

If the same build must run in several environments with different client configuration, explicitly passing approved public values through a server response is a possible design. This experiment does not implement that API or claim to verify its authentication and caching behavior.

The tests ran on September 11, 2026, with Next.js 16.3.4, installed React and React DOM 19.3.0, Node.js 24.15.0, macOS arm64, and Headless Chrome 152. They used a webpack production build, `cacheComponents: false`, and no React Compiler. Nothing was distributed through a CDN, Docker, or a cloud environment. The [runner](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/run-next-batch10.py) and [B/C results from the same build](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/production/2026-09/batch-10/next-env-results.json) are available.
