---
title: When Wrangler-generated types collide with Next.js DOM types
tags: cloudflare, wrangler, nextjs, typescript
published: false
---

_This article is an English translation of the original Japanese article._

I deploy a Next.js application to Cloudflare Workers through `@opennextjs/cloudflare`. After running `wrangler types` to type the D1 binding, TypeScript errors appeared across the application.

```
error TS18046: 'body' is of type 'unknown'.
error TS2339: Property 'name' does not exist on type 'object'.
```

The main symptom was that `request.json()` suddenly returned `unknown`. In my setup, Wrangler's generated runtime definitions collided with the DOM types used by Next.js. I fixed it by removing the generated file and writing a small declaration file that uses `import type`. The exact behavior can vary with versions and `tsconfig` scope, so this article describes the configuration where I reproduced it.

## What happened

By default, `wrangler types` creates `worker-configuration.d.ts`. It contains both the binding `Env` interface and the complete Workers runtime definitions. Global types such as `Request`, `Response`, and `Body` all enter the project.

In the Workers runtime types, `Body#json()` returns `Promise<unknown>`. In the DOM library used by Next.js, it returns `Promise<any>`. Once the generated runtime globals joined the same TypeScript project, every `await request.json()` in a Route Handler became `unknown`, and accesses such as `body.name` failed type checking.

Those Workers types are appropriate in a Worker-only project. A Next.js application also needs the DOM library, and both libraries define the same global names.

## Attempt: `--include-runtime=false`

Wrangler can exclude runtime types from its generated output.

```bash
wrangler types cloudflare-env.d.ts --env-interface CloudflareEnv --include-runtime=false
```

The resulting file contains only the environment interface.

```ts
// Generated cloudflare-env.d.ts
interface CloudflareEnv {
  DB: D1Database;
  ASSETS: Fetcher;
}
```

This looked promising, but it introduced another error.

```
error TS2552: Cannot find name 'D1Database'. Did you mean 'IDBDatabase'?
```

`D1Database` and `Fetcher` are global names supplied by the runtime definitions. Including the runtime caused the DOM collision, while excluding it left the generated interface unable to resolve those names.

## Fix: a handwritten declaration file with `import type`

I stopped generating the file and imported only the binding types I needed.

```bash
npm i -D @cloudflare/workers-types
```

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

This works for three reasons:

- Types brought in with `import type` stay scoped to this module. The Workers versions of `Request` and `Response` do not leak into the global namespace or collide with the DOM library.
- `declare global` exposes only `CloudflareEnv`. `getCloudflareContext()` from `@opennextjs/cloudflare` returns its `env` using this interface, which gives `env.DB` the `D1Database` type.
- The import already makes the declaration file a module. The final `export {}` is included to make that status explicit, but it is not required.

The binding type is then available at the call site.

```ts
import { getCloudflareContext } from "@opennextjs/cloudflare";

function getDb() {
  return getCloudflareContext().env.DB; // inferred as D1Database
}
```

## Tradeoff

The handwritten file must be updated when a binding is added. This gives up the main benefit of `wrangler types`, which generates an interface from `wrangler.jsonc`.

For my application, the bindings change infrequently and consist of one D1 database plus static assets. Maintaining a few lines in one file has not been a problem. A larger project with many bindings could generate `CloudflareEnv` and then transform the output to add scoped type imports.

## Summary

- Wrangler's generated file can include Workers runtime globals that collide with the DOM library in a Next.js project. A sudden `unknown` return type from `json()` is one symptom.
- In my configuration, `--include-runtime=false` left binding types such as `D1Database` unresolved.
- A handwritten declaration file using `import type` and `declare global` types the bindings without adding Workers request and response globals.

Worker-only projects do not have the same DOM coexistence problem, which made the cause harder to find.

## Environment

- `@opennextjs/cloudflare` 1.20, Wrangler 4.113, and `@cloudflare/workers-types` 5.x
- Next.js 16 App Router. Next.js 15 can have the same type structure
