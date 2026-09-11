---
title: "Choosing type or interface by declaration merging and conflict diagnostics"
published: false
tags: typescript, testing
canonical_url: null
---

A useful starting point for choosing `type` or `interface` is whether other declarations should be allowed to extend the same named contract. Both can describe ordinary objects, but adding declarations and combining conflicting properties produce different diagnostics.

Compiling small examples with TypeScript 7.0.2 gave these results:

| Operation | Result |
| --- | --- |
| Add a different property through another declaration of the same `interface` | Declarations merge; the added property is also required |
| Redeclare the same `type` name | TS2300 |
| Change `id: string` to `id: number` through `interface extends` | TS2430 at the extending declaration |
| Define `{ id: string } & { id: number }` | Definition passes; `id` becomes `never` |
| Assign `{ id: 1 }` to that intersection | TS2322 at the assignment |

## Merging an interface also affects existing consumers

```ts
export interface Ticket { title: string }
export interface Ticket { traceId: string }
export const ticket: Ticket = { title: "Fix timer", traceId: "local-1" };
console.log(ticket.traceId);
```

This compiles, runs, and prints `local-1`. The second declaration adds a member to the same `Ticket`; it does not create a derived type with a different name. An object that omits `traceId` now produces TS2741.

The official [declaration merging documentation](https://www.typescriptlang.org/docs/handbook/declaration-merging.html) describes how interface members merge and the matching-type requirement when a non-function member is declared again. This experiment covers the case of adding a different property.

A library can use this behavior as an extension contract for consumers. Adding a required member, however, also changes type checking for existing code. This does not mean identical names in arbitrary files automatically merge across an entire project. The declarations must resolve to the same target in the relevant scope. Real library extensions may also require mechanisms such as module augmentation.

This is a composition experiment within one module, not an implemented extension for a particular library.

## Preventing redeclaration is different from restricting values exactly

```ts
type Ticket = { title: string };
type Ticket = { traceId: string };
export {};
```

Declaring both aliases in the same module produces TS2300 on both declarations. That does not mean using `type` always rejects extra object properties.

```ts
type Ticket = { title: string };
const input = { title: "Fix timer", debug: true };
const ticket: Ticket = input;
console.log("debug" in ticket);
```

This passed and printed `true`. The annotation did not remove `debug` at runtime. Whether an alias can be reopened for declaration merging is separate from whether a value is structurally assignable. [Everyday types](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#differences-between-type-aliases-and-interfaces) covers the shared capabilities of aliases and interfaces and their difference in declaration merging.

## Check where a composition conflict fails

```ts
interface TextId { id: string }
interface NumericId extends TextId { id: number }
export {};
```

This fails at the declaration of `NumericId`. Replacing `id` with a number means it no longer satisfies `TextId`.

An intersection instead requires both conditions at once:

```ts
type TextId = { id: string };
export type Combined = TextId & { id: number };
type IsNever<T> = [T] extends [never] ? true : false;
export const check: IsNever<Combined["id"]> = true;
console.log(check);
```

The definition itself passed. A small conditional type confirmed that `Combined["id"]` was `never`, and assigning `true` to `check` also passed. The property would need to satisfy both `string` and `number`.

Assigning `{ id: 1 }` to this `Combined` then produced TS2322. The `&` operator does not overwrite a shared property with the type on its right. A combined type can be declared even when it has no usable value.

## What these results justify

An `interface` is a candidate when declaration merging is an intentional extension point for consumers. Use `type` to name alternatives such as a union. For application object types that either form can express, following the existing code convention is reasonable. This experiment did not establish a reason to rewrite all such declarations into one form.

The tests ran on September 11, 2026, with macOS arm64, Node.js 24.15.0, TypeScript 7.0.2, `strict: true`, `target: ES2022`, `module: ESNext`, and `moduleResolution: Bundler`. Type declarations disappeared from the emitted JavaScript; the object and logging code remained. Compiler performance and large module-augmentation setups were not measured.

The T04 cases in the [reproduction code](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/language-batch08/compiler-cases.json) and the [diagnostics and emitted files](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/production/2026-09/batch-08/compiler-results.json) show whether each error occurs at declaration or assignment.
