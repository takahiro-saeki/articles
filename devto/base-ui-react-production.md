---
title: Using Base UI with a shadcn/ui-style component layer in production
tags: react, baseui, shadcn, tailwind
published: false
---

_This article is an English translation of the original Japanese article._

I use Base UI (`@base-ui/react`) for the UI primitives in an indie web service. Base UI is an unstyled React component library.

I like the shadcn/ui approach of combining Tailwind, cva, and components that live in my own repository, but I wanted Base UI underneath that component layer. This article shows the structure I use and the differences I noticed after working with Radix-based components.

## Overall structure

Following the same idea as shadcn/ui, I keep thin wrappers that I own under `components/ui/`. The only major change is that the primitives come from Base UI instead of Radix.

```
components/ui/
├── button.tsx        ← @base-ui/react/button
├── dialog.tsx        ← @base-ui/react/dialog
├── tabs.tsx          ← @base-ui/react/tabs
├── sheet.tsx         ← built on dialog
├── avatar.tsx        ← @base-ui/react/avatar
├── dropdown-menu.tsx
├── select.tsx
└── ...
```

Here is a shortened version of the button wrapper. It defines variants with cva and applies them to the Base UI primitive, which should look familiar if you have used shadcn/ui.

```tsx
"use client"

import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-lg text-sm font-medium transition-all focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.98] disabled:opacity-50 ...",
  {
    variants: {
      variant: {
        default: "border-primary bg-primary text-primary-foreground ...",
        outline: "border-border bg-background hover:bg-muted ...",
        destructive: "bg-destructive/10 text-destructive ...",
      },
      size: { default: "h-8 px-2.5", sm: "h-7 px-2.5", icon: "size-8" },
    },
  },
)
```

## Differences you notice when coming from Radix

### 1. Imports use component subpaths

```tsx
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { Button as ButtonPrimitive } from "@base-ui/react/button"
```

Instead of packages such as `@radix-ui/react-dialog`, Base UI uses one package with subpath imports. This has made dependency management simpler for me.

### 2. Types are organized into namespaces

Base UI exposes types through namespaces such as `DialogPrimitive.Root.Props`.

```tsx
function DialogContent({
  className,
  children,
  ...props
}: DialogPrimitive.Popup.Props & { showCloseButton?: boolean }) {
  // ...
}
```

For wrappers, this is more direct than writing `React.ComponentProps<typeof DialogPrimitive.Content>` and keeps the type declarations shorter.

### 3. Some parts have different names

Radix calls the dialog overlay `Overlay`, while Base UI calls it `Backdrop`. The dialog body is `Popup` rather than `Content`. When porting a shadcn/ui dialog to Base UI, this is the mapping to remember.

```tsx
<DialogPortal>
  <DialogPrimitive.Backdrop className="fixed inset-0 bg-black/10 ..." />
  <DialogPrimitive.Popup className="fixed top-1/2 left-1/2 z-50 ...">
    {children}
  </DialogPrimitive.Popup>
</DialogPortal>
```

### 4. State attributes are `data-open` and `data-closed`

Radix uses a single attribute such as `data-state="open"`. Base UI adds attributes for each state, including `data-open` and `data-closed`. The Tailwind classes change accordingly.

```
Radix:   data-[state=open]:animate-in  data-[state=closed]:animate-out
Base UI: data-open:animate-in          data-closed:animate-out
```

It is a small difference, but the class strings become noticeably shorter. That helps when a shadcn-style component layer contains many animated components.

## What it has been like to use

- Dialog, Popover, and Tooltip have structures that feel close to their Radix counterparts. The part names, data attributes, and type references still need to be translated.
- Radix still has more documentation and accumulated community knowledge. Searching an error rarely finds an article about Base UI, so I expect to read the official documentation and GitHub issues.
- Most shadcn/ui structure and class design can be reused. Replacing the primitives and mapping the names account for most of the work.

If Radix already works for your project, there is no need to replace it in a hurry. I tried Base UI in a new project and adopted it while checking the differences in each component I needed.

## Environment

- `@base-ui/react` 1.3, Next.js 15 App Router, Tailwind CSS v4, and class-variance-authority
- The code samples are shortened extracts from a service in production
