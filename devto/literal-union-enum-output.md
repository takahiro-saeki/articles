---
title: "Inspect emitted JavaScript before replacing enums with literal unions"
published: false
tags: typescript, javascript, node
canonical_url: null
---

If a state only needs to be constrained to `"ready"` or `"waiting"` in the type system, a literal union can express that. If code must also refer to a named value such as `State.Ready` at runtime, it needs a value object as well.

Separate those requirements when comparing an `enum`, a literal union, and an `as const` object. A regular enum emits JavaScript; it is more than another spelling for a type.

## Emit the same states in four forms

The experiment ran on September 11, 2026, with macOS arm64, Node.js 24.15.0, and TypeScript 7.0.2. The build used `strict: true`, `target: ES2022`, `module: ESNext`, and `moduleResolution: Bundler`.

```ts
export enum NumericState { Ready, Waiting }
export enum StringState { Ready = "ready", Waiting = "waiting" }
export type State = "ready" | "waiting";
export const StateValue = { Ready: "ready", Waiting: "waiting" } as const;
export const selected: State = "ready";
console.log(JSON.stringify({ numeric: NumericState, string: StringState, object: StateValue, selected }));
```

The log contained the following values. The emitted JavaScript was inspected as well.

| Definition | What remained at runtime |
| --- | --- |
| Numeric enum | `Ready: 0` and `Waiting: 1`, plus reverse mappings `0: "Ready"` and `1: "Waiting"` |
| String enum | `Ready: "ready"` and `Waiting: "waiting"` |
| Literal union `State` | The type disappeared; the value `"ready"` assigned to `selected` remained |
| `as const` object | `Ready: "ready"` and `Waiting: "waiting"` |

The numeric enum's reverse mapping, and its absence from the string enum, match the [official enums reference](https://www.typescriptlang.org/docs/handbook/enums.html#reverse-mappings). Reverse lookup is a runtime capability of the numeric enum. If the application does not use it, it need not be a selection requirement.

## Derive the value union from an object

```ts
export const StateValue = { Ready: "ready", Waiting: "waiting" } as const;
export type State = typeof StateValue[keyof typeof StateValue];
export const value: State = "ready";
console.log(value, Object.isFrozen(StateValue));
```

`StateValue` holds the named values, and the object supplies the allowed value type. Assigning `"ready"` to `State` passed, and the log printed `ready false`. `Object.isFrozen` was `false` because `as const` does not freeze objects at runtime.

The string enum did not accept a direct assignment merely because the string matched a member's value:

```ts
enum State { Ready = "ready", Waiting = "waiting" }
const value: State = "ready";
export {};
```

This produced TS2322. A string received externally cannot simply be treated as an enum value. A literal union does not establish that an arbitrary, unchecked string is safe either; external input still needs runtime validation.

## Whether const enum disappears also depends on configuration

The following input was compiled with only `isolatedModules` changed:

```ts
const enum State { Ready = "ready", Waiting = "waiting" }
export const value = State.Ready;
console.log(value);
```

With `isolatedModules: false`, the value was inlined in the emitted JavaScript:

```js
export const value = "ready" /* State.Ready */;
console.log(value);
```

With `isolatedModules: true`, code constructing the `State` object and accessing `State.Ready` remained. Both versions printed `ready`. Do not expect every build pipeline to erase the object just because the declaration says `const enum`.

This comparison defines and uses the enum in the same source file. It does not test ambient const enums in a published library's `.d.ts` files or mismatched versions between a definition and its consumers.

## Type stripping makes the syntax constraint visible

With `erasableSyntaxOnly: true`, both the regular enum and const enum produced TS1294. The literal union and `as const` object example passed. This option avoids syntax that needs transformation into JavaScript. The [official configuration reference](https://www.typescriptlang.org/tsconfig/erasableSyntaxOnly.html) lists the affected constructs.

Directly running a `.ts` file containing the regular enum on Node.js 24.15.0, without transformation options, also produced `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`. [Node.js TypeScript support](https://nodejs.org/download/release/v24.15.0/docs/api/typescript.html) distinguishes execution through type stripping from features that require syntax transformation.

A literal union is a candidate when only a type is needed. Deriving a union from an object also provides named runtime values. If existing code depends on enum reverse lookup or a public enum API, inspect those consumers before changing it. This output comparison does not establish a bundle-size or execution-speed advantage.

The T05 cases in the [comparison inputs](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/language-batch08/compiler-cases.json) and the [compiler and runtime results](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/production/2026-09/batch-08/compiler-results.json) preserve the details. Compare alternatives under the runtime requirements and transformation settings the application will actually use.
