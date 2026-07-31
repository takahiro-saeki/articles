---
title: "TailwindのWebとReact Nativeで配色を揃える。小規模なデザイントークン運用"
emoji: "🎨"
type: "tech"
topics: ["designtokens", "reactnative", "tailwindcss", "expo", "frontend"]
published: false
---

Web(Next.js + Tailwind)とiOSアプリ(Expo / React Native)の両方があるサービスを個人開発していると、デザインの一貫性は自分で仕組みを作らない限り守れません。WebはTailwindのユーティリティクラス、React NativeはStyleSheetと、スタイリングの世界が完全に分かれているからです。

私はmonorepoに `packages/design-tokens` という小さなパッケージを作り、色・タイポグラフィ・余白・角丸の名前をWebとアプリで揃えています。React Nativeはパッケージを直接参照し、Webは同じ値をCSS変数に定義します。完全な一元管理ではありませんが、少人数の開発ではこのくらいの仕組みでも配色のずれを減らせました。

## 構成

```
├── apps/
│   ├── web/      ← Next.js + Tailwind CSS v4
│   └── mobile/   ← Expo (React Native StyleSheet)
└── packages/
    └── design-tokens/
        └── src/
            ├── colors.ts      ← セマンティックカラー
            ├── typography.ts  ← フォントサイズ・ウェイト
            ├── spacing.ts     ← 余白・レイアウト
            └── radius.ts      ← 角丸
```

トークンはただのTypeScriptの定数です。ビルドツールもStyle Dictionaryのような変換基盤も入れていません。

```ts
// packages/design-tokens/src/colors.ts
export const colors = {
  /** メインカラー(ボタン、リンク、アクティブ状態) */
  primary: "#0891b2",
  primaryForeground: "#ffffff",

  /** ページ背景 */
  background: "#f9fafb",
  foreground: "#111827",

  /** カード / パネル */
  card: "#ffffff",
  cardForeground: "#111827",

  /** 破壊的アクション */
  destructive: "#ef4444",
  destructiveForeground: "#ffffff",
  // ...
} as const;
```

ポイントは、`primary` や `destructive` のようなセマンティックな名前で定義することです。「シアン500」ではなく「メインカラー」として扱えば、使う側は色の意味だけを意識できます。Web側の色も変える場合は、後述するCSS変数との同期が必要です。

## React Native側: そのままimportする

アプリ側は一番素直です。TypeScriptの定数なので、StyleSheetに直接流し込めます。

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

`as const` を付けてあるので値はリテラル型になり、エディタの補完でトークン一覧が出ます。RN側に関しては、仕組みと呼べるものがほぼ無いのが良いところです。

## Web(Tailwind v4)側: CSS変数として同じ値を定義する

Web側は少しだけ工夫が要ります。TailwindのクラスからJSの定数は参照できないので、CSS変数のレイヤーで合流させます。

```css
/* apps/web/src/styles/globals.css */
:root {
  /* Light theme: @squadnote/design-tokens と同じHEX値で統一 */
  --background: #f9fafb;
  --foreground: #111827;
  --card: #ffffff;
  --primary: #0891b2;
  --primary-foreground: #ffffff;
  /* ... */
}
```

Tailwind v4は `@theme` でCSS変数をそのままユーティリティに割り当てられるので、`bg-primary` や `text-foreground` と書けば、アプリと同じHEX値が使われます。

正直に書くと、ここは**手動で同期しています**。CSS変数の定義にコメントで「design-tokensと同じ値」と書いて、変更時に両方を直す運用です。TSからCSSを自動生成するスクリプトを書くこともできますが、色を変える頻度の低さに対してビルドパイプラインを増やす価値がないと判断しました。トークンの総数が今より大きく増えたら自動生成に切り替えると思います。

## 一番の効果は「色を選ぶ工程が消える」こと

このパッケージを入れてから、新しい画面で毎回色を決める場面が減りました。「このボーダーは何色にするか」と考える代わりに、まず `colors.border` を使えます。Webとアプリを並行して作るときは、この小さな判断を減らせるだけでも助かります。

もう1つ、デザインをFigmaで作る場合も、Figma側のバリアブルとこのトークンを同じセマンティック名で揃えておくと、カンプから実装への変換で迷いが出ません。デザインと実装を1人で両方やる人には特におすすめします。

## この構成が向く人・向かない人

向いているのは、WebとRNの両方を少人数で作っていて、専用の変換基盤を入れるほどトークン数が多くないケースです。構成は小さい一方、Web側の値を手動で同期する作業は残ります。

逆に、テーマ切り替え(ダークモード等)を本格的にやる場合や、トークンをデザインツールと双方向同期したい場合は、Style DictionaryやTokens Studioのような専用基盤を最初から入れた方が良いです。手動同期のCSS変数はテーマが増えると破綻します。

## 環境

- Turborepo + pnpm workspace
- Web: Next.js 15 + Tailwind CSS v4 / Mobile: Expo SDK 54(React Native 0.81)
- コード例は運用中のサービスから抜粋・簡略化しています
