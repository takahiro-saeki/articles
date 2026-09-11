---
title: "Debugging mixed ESM and CommonJS: separate module classification from loading"
published: false
tags: [node, javascript, debugging, testing]
canonical_url: https://zenn.dev/hirodeath/articles/node-esm-commonjs-boundaries
---

You see `require is not defined`, replace it with an import, and then encounter a syntax error in another file. When ESM and CommonJS coexist, changing syntax alone can make the original cause difficult to follow.

First ask how Node.js classifies the file. Then ask how that file loads another module. Separating these questions helps determine whether to change `package.json`, a filename extension, or the asynchronous boundary of the caller.

This investigation ran 10 small-file cases in separate processes on Node.js `v24.15.0`. It used no bundler, TypeScript transformation, or custom loader, and removed `NODE_OPTIONS` from child processes. Official documentation was checked on September 11, 2026; the latest pages displayed `v26.8.2`. The experimental results are specifically for `v24.15.0`.

## Check the extension and nearest package.json first

The [official Packages documentation](https://nodejs.org/api/packages.html) identifies `.mjs` as ESM and `.cjs` as CommonJS. For `.js`, the nearest parent `package.json` can explicitly select the system through `type`.

“Nearest” matters: inspecting only the repository root can miss the applicable setting. The experiment placed a child directory with `type: commonjs` inside one configured with `type: module`.

```text
esm/
  package.json            type: module
  require.js
  legacy.cjs
  nested/
    package.json          type: commonjs
    legacy.js
```

Calling `require()` inside `require.js` failed. In both `legacy.cjs` and `nested/legacy.js`, however, `typeof require` produced `function`. The extension or the inner configuration can select CommonJS even inside an outer ESM package area.

The reverse was checked too. A static `export` in a `.js` file under `type: commonjs` produced a syntax error, while an `.mjs` file in the same area executed successfully.

## An untyped js file is not necessarily CommonJS

Assuming that omitting `type` always preserves the old CommonJS behavior is incomplete for current Node.js. The documentation describes syntax detection: input without an explicit classification can be treated as ESM when it contains ESM-only syntax.

The experiment ran this `.js` file in a directory containing an empty `package.json`:

```js
export const value = 42;
console.log(value);
```

It printed `42` and emitted a `MODULE_TYPELESS_PACKAGE_JSON` warning. The same `export` failed with an explicit `type: commonjs`, but succeeded through syntax detection when `type` was absent.

Adding `type: module` simply to remove that warning also affects existing `.js` files governed by the same setting. First identify the target file and the files sharing that configuration. For a localized migration, `.mjs` and `.cjs` can make the intention explicit.

The performance cost of syntax detection was not measured. This experiment checked execution outcomes and the warning.

## require can load some ES modules

The older rule “CommonJS must always use `import()` to load ESM” also needs qualification. The [CommonJS documentation for the tested version](https://nodejs.org/download/release/v24.15.0/docs/api/modules.html) describes the conditions under which `require()` can load synchronous ESM.

The target ES module contained:

```js
export const value = 42;
```

The CommonJS caller read the named export from the returned object:

```js
console.log(require("../esm/sync.mjs").value);
```

It printed `42`. An `.mjs` extension alone does not establish that `require()` must reject the module.

Changing the target to this made `require()` fail with `ERR_REQUIRE_ASYNC_MODULE` in the same environment:

```js
await Promise.resolve();
export const value = 42;
```

The difference is top-level await. The documentation also excludes synchronous loading when top-level await occurs elsewhere in the imported module graph. The experiment placed it directly in the target module.

## Dynamic import does not turn its caller into ESM

The CommonJS file then loaded the asynchronous ES module like this:

```js
import("../esm/async.mjs").then(m => console.log(typeof require, m.value));
```

The output was `function 42`. It waited for the ES module and obtained its value, while `require` remained available in the caller. Adding an `import()` expression did not switch the entire CommonJS file into ESM.

However, replacing a synchronous load with `import()` means waiting for its result. The caller may also need an asynchronous interface. Distinguish a configuration problem from a change that requires an asynchronous boundary.

## Correct classification does not guarantee correct path resolution

An ESM relative import of `./sync` failed with `ERR_MODULE_NOT_FOUND` even though `sync.mjs` was next to it. The [ESM documentation](https://nodejs.org/api/esm.html) requires extensions for relative and absolute import specifiers.

That is separate from whether the target is ESM or CommonJS. This example needs `./sync.mjs`. A shorthand accepted by a bundler need not work when passed directly to Node.js.

The 10 checked cases were:

| Condition | Result |
| --- | --- |
| require in a `.js` file under `type: module` | `require is not defined` |
| Static export in `.js` under `type: commonjs` | Syntax error |
| `.cjs` under `type: module` | Runs as CommonJS |
| `.mjs` under `type: commonjs` | Runs as ESM |
| `.js` beneath an inner `type: commonjs` package | Uses the inner setting |
| CommonJS requires synchronous ESM | Retrieves the value |
| CommonJS requires ESM with top-level await | `ERR_REQUIRE_ASYNC_MODULE` |
| CommonJS dynamically imports that ESM | Retrieves the value; require remains available |
| An ESM relative import omits the extension | `ERR_MODULE_NOT_FOUND` |
| A `.js` file with no type contains export | Runs through syntax detection, with a warning |

The [reproduction script](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/node-module-boundaries.mjs) creates a temporary directory, asserts exit codes and output for every case, then removes it. It does not change an existing project's `package.json`.

Conditional package `exports`, CommonJS named-export detection, and TypeScript configuration are outside this experiment. For an initial investigation of mixed-module errors, check the Node.js version, file classification, loading method, and relative path in that order.
