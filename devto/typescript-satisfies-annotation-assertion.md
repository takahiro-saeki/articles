---
title: "Comparing satisfies, type annotations, and assertions through compiler output"
published: false
tags: typescript, javascript, testing
canonical_url: null
---

Use `satisfies` when a configuration value should meet a type while its individual properties remain convenient to use. Two common shortcuts are misleading, though: that it can never affect inference, and that it always rejects extra keys.

The comparison uses the same object under a type annotation, `satisfies`, and `as`, with emitted declarations and diagnostics as evidence. For this display configuration, the differences were:

| Form | Type when reading `ready` | Missing `waiting` |
| --- | --- | --- |
| `: Notices` | `string | number[]` | Error |
| `satisfies Notices` | `string` | Error |
| `as Notices` | `string | number[]` | Accepted in this example |

## Inspect declarations as well as editor hints

The experiment ran on September 11, 2026, with macOS arm64, Node.js 24.15.0, and TypeScript 7.0.2. The compiler used `strict: true`, `target: ES2022`, `module: ESNext`, and `moduleResolution: Bundler`, with type checking and declaration emit. The display values are synthetic test data.

```ts
type Notices = Record<"ready" | "waiting", string | number[]>;
export const annotated: Notices = { ready: "Ready", waiting: [1, 2] };
export const checked = { ready: "Ready", waiting: [1, 2] } satisfies Notices;
export const asserted = { ready: "Ready", waiting: [1, 2] } as Notices;
console.log(checked.ready.toUpperCase());
```

`checked.ready.toUpperCase()` passed and printed `READY`. Calling the same method on `annotated.ready` produced TS2339 because the property could also be an array.

The emitted declarations explain that difference:

```ts
type Notices = Record<"ready" | "waiting", string | number[]>;
export declare const annotated: Notices;
export declare const checked: {
    ready: string;
    waiting: number[];
};
export declare const asserted: Notices;
export {};
```

`checked` retains the types of individual properties. The other two variables have the annotated `Notices` type. This makes `satisfies` useful when a configuration needs a shared compatibility check without requiring extra narrowing wherever a particular value is used. The [TypeScript 4.9 documentation](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html) describes this use of compatibility checks while retaining a useful expression type.

## An assertion can leave a missing property undetected

```ts
type Notices = Record<"ready" | "waiting", string | number[]>;
const value = { ready: "Ready" } as Notices;
console.log(value.waiting);
```

This code passed type checking and printed `undefined`. Changing the assertion to `satisfies Notices` produced TS2741 for the missing `waiting` property. An assertion does not create that property.

This also does not mean every possible assertion is accepted. TypeScript can reject an assertion based on the relationship between the types. The finding here is narrower: it accepts this particular object despite the missing required key. As the [official explanation of type assertions](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#type-assertions) states, assertions do not validate or convert runtime values.

## Context can affect inference

```ts
export const plain = { enabled: true, count: 1 };
export const checked = { enabled: true, count: 1 } satisfies { enabled: boolean; count: number };
export const frozenType = { enabled: true, count: 1 } as const;
```

In the emitted declarations, `plain.enabled` was `boolean`, while `checked.enabled` was `true`. Both `count` properties were `number`. Context from the target type means literal inference is not necessarily identical.

With `as const`, `frozenType.enabled` became a readonly `true`, and `frozenType.count` became a readonly `1`. This does not freeze the object at runtime either. If a configuration will be modified later, decide whether that property should remain the literal `true` or accept both boolean values, including `false`.

## Extra keys are not always rejected

Writing `{ ready: "Ready", waiting: [1], typo: 1 } satisfies Notices` directly produced TS2353 for the extra `typo` property. Assigning that object to a variable first changed the outcome:

```ts
type Notices = Record<"ready" | "waiting", string | number[]>;
const input = { ready: "Ready", waiting: [1], typo: 1 };
const value = input satisfies Notices;
console.log(value.typo);
```

This passed and printed `1`. A value can satisfy the required structure while retaining additional properties. Restricting the keys of external data requires a runtime check separate from these type constructs.

For the local configuration in this experiment, use `satisfies` to catch mistakes while retaining operations specific to each value. Use an annotation to specify the type the variable should expose. Reserve `as` for places where other evidence supports the asserted type.

The T02 cases in the [reproduction code](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/language-batch08/compiler-cases.json) and the [execution record](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/production/2026-09/batch-08/compiler-results.json) include both accepted declarations and deliberately invalid inputs. Do not assume diagnostic numbers or inference remain identical across compiler versions; compare declaration output when upgrading.
