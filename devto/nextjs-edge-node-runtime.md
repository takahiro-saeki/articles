---
title: "Comparing Next.js Edge and Node.js: a successful build is not a successful request"
published: false
tags: nextjs, node, javascript, testing
canonical_url: null
---

Runtime compatibility needs an HTTP execution check as well as an import or build check. In Next.js 16.3.4, the Edge route containing `eval` built successfully but returned 500 when called.

This version also warns that `runtime = 'edge'` is deprecated. The [official migration notice](https://nextjs.org/docs/messages/edge-runtime-deprecated) recommends removing that export and using the default Node.js runtime. This experiment checks compatibility in existing code; it is not a recommendation to adopt Edge for a new application.

## Run a Web API-only operation in both runtimes

The first operation reads a query string and returns its UTF-8 byte count and SHA-256:

```js
export async function webResponse(request) {
  const text = new URL(request.url).searchParams.get('text') ?? '';
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const hex = Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, '0')).join('');
  return Response.json({ text, bytes: data.length, sha256: hex });
}
```

Separate Route Handlers called it with `runtime = 'nodejs'` and `runtime = 'edge'`. Sending `?text=fixture` returned 200 in both cases, with text `fixture`, bytes `7`, and the same SHA-256. Python independently computed the hash for comparison.

This operation uses Request, URL, TextEncoder, Web Crypto, and Response, and ran in both runtimes. The [Edge Runtime API list](https://nextjs.org/docs/app/api-reference/edge) includes these Web APIs.

That does not establish compatibility for arbitrary npm packages. Check the APIs used by the route and its imported dependencies.

## Import a function that reads a file

The next function reads a synthetic `fixture.txt` inside the test project:

```js
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
export async function readFixture() {
  return (await readFile(join(process.cwd(), 'fixture.txt'), 'utf8')).trim();
}
```

Calling it from a Node.js route returned `local fixture only` with status 200. Importing the same function from an Edge route failed during the build, with UnhandledSchemeError entries for `node:fs/promises` and `node:path`.

The import trace continued from the Node module through `lib/node-file.js` into the Route Handler. It identifies the dependency path as well as the module named in the error.

Changing import syntax to ES Modules would not remove the dependency on Node's file API. This experiment did not add a polyfill or replace local files with external storage.

## A successful build can still fail during execution

The Edge comparison also used this code. Its expression is fixed; it does not pass external input into eval.

```js
export const runtime = 'edge';
export function GET() { return Response.json({ value: eval('1 + 2') }); }
```

The production build exited with 0. Starting that build with `next start` and issuing GET returned 500 and `Internal Server Error`. The server logged `EvalError: Code generation from strings disallowed for this context`.

The Node.js route using the same expression returned 200 with `value: 3`. Across the 6 conditions, failures appeared at different stages:

| Operation | Runtime | Build | HTTP execution |
| --- | --- | --- | --- |
| Hash a string with Web APIs | Node.js | Success | 200 |
| Hash a string with Web APIs | Edge | Success, deprecation warning | 200 |
| Node file APIs | Node.js | Success | 200 |
| Import the same file-reading function | Edge | Failure | Not executed |
| eval of a fixed expression | Node.js | Success | 200, value 3 |
| eval of a fixed expression | Edge | Success, deprecation warning | 500, EvalError |

The [unsupported Edge APIs reference](https://nextjs.org/docs/app/api-reference/edge#unsupported-apis) documents native Node API and dynamic-code-generation restrictions. The table demonstrates that a build does not detect every violation at the same stage.

## Do not infer placement or speed from a runtime's name

The tests ran on September 11, 2026, with Next.js 16.3.4, installed React and React DOM 19.3.0, and Node.js 24.15.0 on macOS arm64. They used a webpack production build, `cacheComponents: false`, no React Compiler, and local `next start`.

Cloud-region placement, cold starts, database connections, ISR, streaming, and other providers' Workers environments were not measured. These results do not establish that Edge is faster or that Node can reach any connection destination.

The [operation](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/next-batch10/lib/web-response.js), [HTTP results](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/production/2026-09/batch-10/runtime-http-results.json), and [build/runtime failure records](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/production/2026-09/batch-10/negative-build-results.json) are available. When removing an existing Edge configuration, inspect its APIs and dependencies, then exercise actual requests before deciding compatibility is established.
