---
title: "Radixの後継?Base UI(@base-ui/react)をshadcn/uiスタイルで本番採用している構成"
emoji: "🧩"
type: "tech"
topics: ["baseui", "react", "shadcn", "tailwindcss", "nextjs"]
published: false
---

個人開発のWebサービスで、UIプリミティブに **Base UI(@base-ui/react)** を使っています。Radix UIやMaterial UI、Floating UIを作ってきたメンバーが開発しているheadless UIライブラリで、v1系がリリースされて実戦投入できる段階になっています。

「shadcn/uiの構成(Tailwind + cva + コピペ所有のコンポーネント)は好きだが、プリミティブ層をBase UIにしたい」という組み方をしているので、その実例と、書いていて感じたRadixとの違いをまとめます。

## 構成の全体像

shadcn/uiと同じ思想で、`components/ui/` 配下に自分が所有する薄いラッパーを置いています。中身のプリミティブだけがRadixではなくBase UIです。

```
components/ui/
├── button.tsx        ← @base-ui/react/button
├── dialog.tsx        ← @base-ui/react/dialog
├── tabs.tsx          ← @base-ui/react/tabs
├── sheet.tsx         ← dialogベース
├── avatar.tsx        ← @base-ui/react/avatar
├── dropdown-menu.tsx
├── select.tsx
└── ...
```

たとえばbuttonはこうなります。cvaでバリアントを定義してBase UIのプリミティブに被せる、見慣れたshadcnスタイルです。

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

## Radixから来た人が気付く違い

### 1. インポートはコンポーネント単位のサブパス

```tsx
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { Button as ButtonPrimitive } from "@base-ui/react/button"
```

`@radix-ui/react-dialog` のようなパッケージ分割ではなく、1パッケージ+サブパスです。依存の管理が楽になりました。

### 2. 型が名前空間で整理されている

Base UIの型は `DialogPrimitive.Root.Props` のように「コンポーネント.パーツ.Props」の名前空間でアクセスします。

```tsx
function DialogContent({
  className,
  children,
  ...props
}: DialogPrimitive.Popup.Props & { showCloseButton?: boolean }) {
  // ...
}
```

Radixの `React.ComponentProps<typeof DialogPrimitive.Content>` と書くより素直で、ラッパーを書くときの記述量が減ります。

### 3. パーツの名前が違う: Overlay→Backdrop、Content→Popup

DialogのオーバーレイはRadixの `Overlay` ではなく `Backdrop`、本体は `Content` ではなく `Popup` です。shadcn/uiのdialogをBase UIに移植すると、この対応表を頭に入れることになります。

```tsx
<DialogPortal>
  <DialogPrimitive.Backdrop className="fixed inset-0 bg-black/10 ..." />
  <DialogPrimitive.Popup className="fixed top-1/2 left-1/2 z-50 ...">
    {children}
  </DialogPrimitive.Popup>
</DialogPortal>
```

### 4. 状態のdata属性が data-open / data-closed

Radixは `data-state="open"` の1属性方式ですが、Base UIは状態ごとに `data-open` / `data-closed` という属性が生えます。Tailwindでのスタイリングはこう変わります。

```
Radix:   data-[state=open]:animate-in  data-[state=closed]:animate-out
Base UI: data-open:animate-in          data-closed:animate-out
```

地味な差ですが、クラス文字列がかなり短くなります。アニメーション付きのコンポーネントを量産するshadcnスタイルだと、読みやすさに効いてきます。

## 使ってみての所感

- **書き味はRadixとほぼ同じ**です。Portal/Trigger/Popupの構造、非制御と制御の切り替え、フォーカス管理など、Radixで身につけた感覚のまま書けます。移行コストは「名前の対応表」程度でした
- ドキュメントの情報量やコミュニティの蓄積はまだRadixに分があります。エラーで検索しても記事はほぼ出てこないので、公式ドキュメントとGitHubを読む前提の人向けです
- shadcn/uiの資産(構造・クラス設計)はほぼそのまま流用できます。プリミティブの置き換えと名前の読み替えが主な作業です

「今Radixで困っていないなら急いで乗り換える必要はない、新規で始めるなら選択肢に入れる価値は十分ある」というのが現時点の私の結論です。

## 環境

- @base-ui/react 1.3 / Next.js 15(App Router)/ Tailwind CSS v4 / class-variance-authority
- コード例は運用中のサービスから抜粋・簡略化しています
