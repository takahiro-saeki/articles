---
title: Keeping colors consistent between Tailwind on the web and React Native
tags: designtokens, reactnative, tailwind, expo
published: false
---

_This article is an English translation of the original Japanese article._

I maintain an indie service with both a Next.js web app and an Expo iOS app. Design consistency does not happen by itself because the web app uses Tailwind utilities while React Native uses `StyleSheet`.

I added a small `packages/design-tokens` package to the monorepo so both apps use the same names for colors, typography, spacing, and border radii. React Native imports the package directly. The web app defines the same values as CSS variables. It is not a fully generated single source of truth, but it has been enough to reduce color drift in a small project.

## Project structure

```
├── apps/
│   ├── web/      ← Next.js + Tailwind CSS v4
│   └── mobile/   ← Expo (React Native StyleSheet)
└── packages/
    └── design-tokens/
        └── src/
            ├── colors.ts      ← semantic colors
            ├── typography.ts  ← font sizes and weights
            ├── spacing.ts     ← spacing and layout
            └── radius.ts      ← border radii
```

The tokens are plain TypeScript constants. I did not add a build tool or a transformation layer such as Style Dictionary.

```ts
// packages/design-tokens/src/colors.ts
export const colors = {
  /** Main color for buttons, links, and active states */
  primary: "#0891b2",
  primaryForeground: "#ffffff",

  /** Page background */
  background: "#f9fafb",
  foreground: "#111827",

  /** Cards and panels */
  card: "#ffffff",
  cardForeground: "#111827",

  /** Destructive actions */
  destructive: "#ef4444",
  destructiveForeground: "#ffffff",
  // ...
} as const;
```

The important part is using semantic names such as `primary` and `destructive`. Calling a token "main color" rather than "cyan 500" lets its consumers think about meaning instead of a particular shade. Changing a web color still requires synchronizing the CSS variables described below.

## React Native: import the tokens directly

The mobile side is straightforward because `StyleSheet` can use the TypeScript constants directly.

```tsx
// apps/mobile/src/app/login.tsx
import { colors, textColors } from "@squadnote/design-tokens";

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
  },
  title: {
    color: textColors.primary,
  },
  button: {
    backgroundColor: colors.primary,
  },
});
```

The `as const` assertion preserves literal types, so the editor can suggest every available token. On the React Native side, the lack of extra machinery is one of the best parts of this setup.

## Tailwind v4: define the same values as CSS variables

The web side needs one extra layer because Tailwind classes cannot read JavaScript constants. CSS variables provide the meeting point.

```css
/* apps/web/src/styles/globals.css */
:root {
  /* Light theme: same HEX values as @squadnote/design-tokens */
  --background: #f9fafb;
  --foreground: #111827;
  --card: #ffffff;
  --primary: #0891b2;
  --primary-foreground: #ffffff;
  /* ... */
}
```

Tailwind v4 can map CSS variables to utilities through `@theme`. Classes such as `bg-primary` and `text-foreground` then use the same HEX values as the mobile app.

I synchronize this part manually. A comment next to the CSS variables says that they match `design-tokens`, and I update both places when a color changes. I could generate CSS from TypeScript, but color changes are infrequent enough that another build step would cost more than it saves. If the token set grows much larger, I will probably switch to generation.

## The main benefit is removing color selection from routine work

Since adding the package, I make fewer one-off color decisions on new screens. Instead of deciding which color a border should use, I start with `colors.border`.

The same semantic names can also be used for Figma variables. That removes some ambiguity when moving from a mockup to implementation, especially when the same person handles both design and code.

## When this setup fits

This works well for a small team building both web and React Native apps without enough tokens to justify a dedicated transformation pipeline. The tradeoff is that the web values still require manual synchronization.

For extensive theme switching, including dark mode, or two-way synchronization with design tools, I would start with a system such as Style Dictionary or Tokens Studio. Manually duplicated CSS variables become difficult to maintain as the number of themes grows.

## Environment

- Turborepo and pnpm workspace
- Web: Next.js 15 and Tailwind CSS v4
- Mobile: Expo SDK 54 and React Native 0.81
- The code samples are shortened extracts from a service in production
