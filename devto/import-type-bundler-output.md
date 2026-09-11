---
title: "What remains without import type? Comparing tsc, esbuild, and side effects"
published: false
tags: typescript, javascript, esbuild, testing
canonical_url: null
---

Some configurations automatically erase an import used only as a type, even without `import type`. With `verbatimModuleSyntax: true`, however, the spelling also changed whether a module's side effect ran. Check type-checking success separately from runtime module evaluation.

In particular, these forms do not always emit the same JavaScript:

- `import type { Ticket } from "./registry.js"`
- `import { type Ticket } from "./registry.js"`

## Put a visible marker in the imported module

The experiment ran on September 11, 2026, with macOS arm64, Node.js 24.15.0, TypeScript 7.0.2, and esbuild 0.28.2. Compiler options were `strict: true`, `target: ES2022`, `module: ESNext`, and `moduleResolution: Bundler`. esbuild targeted Node ESM with bundling and tree shaking enabled. The test package did not declare `sideEffects: false`.

`registry.ts` contains only a type and a log showing that the module was evaluated. It performs no external requests or real application initialization.

```ts
export interface Ticket { title: string }
console.log("registry evaluated");
```

The caller starts with this code:

```ts
import { Ticket } from "./registry.js";
const ticket: Ticket = { title: "Fix timer" };
console.log(ticket.title);
```

Only the import was changed when comparing emitted JavaScript and runtime logs. In the personal repository, the [type-sharing package](https://github.com/takahiro-saeki/circle-hub/blob/770de5f2989775cfd95f7a9c4529565a2b48d2fd/packages/api/src/index.ts) exposes API types through `export type`. The `Ticket` and log here are a minimal example designed to separate type references from runtime loading.

## Both spelling and configuration affected the result

In this table, "evaluation" means the log printed `registry evaluated`. Every successful example also printed the caller's `Fix timer` message.

| Import form | verbatim | tsc | Registry evaluation in tsc output | Registry evaluation in esbuild bundle |
| --- | --- | --- | --- | --- |
| `import { Ticket }` | false | Pass | No | No |
| `import type { Ticket }` | false | Pass | No | No |
| `import { type Ticket }` | false | Pass | No | No |
| Side-effect import + `import type` | false | Pass | Yes | Yes |
| `import { Ticket }` | true | TS1484 | Emit stopped | Yes |
| `import type { Ticket }` | true | Pass | No | No |
| `import { type Ticket }` | true | Pass | Yes | Yes |
| Side-effect import + `import type` | true | Pass | Yes | Yes |

The test used `noEmitOnError: true`, so no tsc-generated JavaScript was executed for the TS1484 row. esbuild bundled that input successfully, but that does not mean it passed type checking.

## An inline type modifier left an empty import

This is the tsc output for `import { type Ticket }` with `verbatimModuleSyntax: true`:

```js
import {} from "./registry.js";
const ticket = { title: "Fix timer" };
console.log(ticket.title);
```

The name `Ticket` disappeared, but `import {} from "./registry.js"` remained. That dependency still evaluates the module, so the marker was printed. Making the entire statement type-only with `import type { Ticket }` removed the statement and the log. The [official verbatimModuleSyntax documentation](https://www.typescriptlang.org/tsconfig/verbatimModuleSyntax.html) also distinguishes these outputs.

When only a type is needed, use a whole-statement `import type`. When initialization is also required, make that a separate import:

```ts
import "./registry.js";
import type { Ticket } from "./registry.js";
const ticket: Ticket = { title: "Fix timer" };
console.log(ticket.title);
```

This printed the marker under both settings and both tools tested here. That does not establish the same outcome for dependencies marked as free of side effects or for other bundler configurations. This experiment observes two local files.

## Successful bundling does not establish type correctness

```ts
export const count: number = "wrong";
console.log(typeof count);
```

tsc reported TS2322, while esbuild succeeded and the bundle printed `string`. The [esbuild TypeScript caveats](https://esbuild.github.io/content-types/#typescript-caveats) explain that TypeScript's type checker is responsible for checking the annotations.

Marking dependencies as type-only and running type checking in the build process address different concerns. In this reproduction, an input could run after import removal while still containing a mistake tsc detected. Bundle success alone did not catch that mistake.

Run the T06 cases in the [comparison inputs](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/language-batch08/compiler-cases.json) with the [execution script](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/language-batch08/run-compiler.mjs) to inspect the combined [diagnostics, emitted JavaScript, and logs](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/production/2026-09/batch-08/compiler-results.json). When introducing the setting into an application, inspect type-only references and imports intended for initialization separately.
