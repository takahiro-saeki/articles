---
title: Removing handwritten API types with tRPC RouterInputs and RouterOutputs
tags: trpc, typescript, nextjs, react
published: false
---

_This article is an English translation of the original Japanese article._

tRPC can derive every procedure's input and output types from the router definition. The UI does not need to repeat the server response as an interface such as `interface Schedule { ... }`.

I use tRPC v11 in a monorepo containing a Next.js web app and an Expo mobile app. The web side defines these two helper types:

```ts
import { type inferRouterInputs, type inferRouterOutputs } from "@trpc/server";
import { type AppRouter } from "~/server/api/root";

/** Input types for every procedure */
export type RouterInputs = inferRouterInputs<AppRouter>;
/** Output types for every procedure */
export type RouterOutputs = inferRouterOutputs<AppRouter>;
```

These are the patterns I use most often.

## 1. Get the item type from a list

A `findMany`-style procedure returns an array. Indexing it with `[number]` extracts the element type.

```ts
type Schedule = RouterOutputs["schedule"]["list"][number];
```

Changing the server-side `select` or `include` automatically updates this type.

## 2. Use the output type for child component props

When a list page passes data to a child component, its props can come from the same output type.

```tsx
type Props = {
  schedule: RouterOutputs["schedule"]["list"][number];
  onSelect: (id: string) => void;
};

function ScheduleCard({ schedule, onSelect }: Props) {
  // schedule.title and the other fields are inferred
}
```

The API response and component props now have the same source. If the server response changes, TypeScript reports the mismatch in the child component too.

## 3. Index into nested properties

For responses that include relations, regular indexed access reaches the nested type.

```ts
type Member = RouterOutputs["membership"]["listByOrg"][number];
type MemberUser = Member["user"]; // Relation loaded through `with`
```

## 4. Build form values from `RouterInputs`

Deriving create and update form values from the mutation input avoids maintaining a second type beside the Zod schema.

```ts
type CreateScheduleInput = RouterInputs["schedule"]["create"];

// Remove fields that the form does not edit
type ScheduleFormValues = Omit<CreateScheduleInput, "orgId">;
```

Adding a field to `.input(z.object({...}))` produces a type error in the form code that must now supply it.

## 5. Keep cache updates type-safe

The same inferred types flow into optimistic updates with TanStack Query.

```ts
utils.schedule.list.setData({ orgId }, (old) =>
  old?.map((s) => (s.id === id ? { ...s, done: true } : s)),
);
// old is inferred as RouterOutputs["schedule"]["list"] | undefined
```

The `setData` callback already has the correct argument type, so it needs no annotation. The fewer response types I write by hand, the more inference carries through the rest of the client.

## Re-export the types from a monorepo package

When web and mobile use the same tRPC client types, a small package such as `packages/api` can re-export `AppRouter`, `RouterInputs`, and `RouterOutputs`.

```ts
// packages/api/src/index.ts
export type { AppRouter } from "../../apps/web/src/server/api/root";
export type { RouterInputs, RouterOutputs } from "../../apps/web/src/trpc/react";
```

My repository still has places where mobile imports `AppRouter` directly from the web app. The example above is the boundary I am moving toward. Because it still uses a relative path into the web implementation, moving the router definition itself into a shared package would make that boundary clearer later.

## Summary

- Derive UI types from `RouterOutputs["router"]["procedure"]` instead of rewriting them.
- Use `[number]` for an array element and indexed access for nested values.
- Derive form values from `RouterInputs` to avoid duplicating the Zod input schema.
- Keep client type checks connected to server-side changes.

## Environment

- tRPC v11, TypeScript 5, Next.js 15, and Expo in a Turborepo monorepo
