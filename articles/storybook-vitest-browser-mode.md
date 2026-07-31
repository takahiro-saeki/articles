---
title: "StorybookのストーリーをそのままVitestのテストにする。nextjs-vite + browser modeの構成"
emoji: "📖"
type: "tech"
topics: ["storybook", "vitest", "nextjs", "playwright", "testing"]
published: false
---

Next.jsの個人開発プロジェクトで、UIコンポーネントのカタログとテストを別々に維持するのはコストが高すぎます。私は「**ストーリーを書けば、それがそのままブラウザ実行のテストになる**」構成にしていて、カタログ(Storybook)とコンポーネントテストを1つの成果物で兼ねています。

Storybookのvitest addonとVitestのbrowser modeを組み合わせた構成です。設定ファイルは実質2つなので、実物を貼りながら紹介します。

## 構成の概要

- Storybook(framework: `@storybook/nextjs-vite`)でコンポーネントカタログを作る
- `@storybook/addon-vitest` のVitestプラグインが、**各ストーリーをテストケースに変換**する
- テストはVitestのbrowser mode(Playwright経由の実Chromium)で走る。jsdomではなく本物のブラウザ

つまり `Button.stories.tsx` を書くと、Buttonを実ブラウザで描画するテストが増えます。ストーリーにplay関数があれば、その操作も同じテストで検証できます。

## 設定1: .storybook/main.ts

```ts
import type { StorybookConfig } from '@storybook/nextjs-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    '@chromatic-com/storybook',
    '@storybook/addon-vitest',   // ← これ
    '@storybook/addon-a11y',
    '@storybook/addon-docs',
  ],
  framework: '@storybook/nextjs-vite',
  staticDirs: ['../public'],
};
export default config;
```

frameworkに `@storybook/nextjs-vite` を使うと、Next.js固有の要素(next/image、next/navigationなど)を含むコンポーネントもViteベースのStorybookでそのまま動きます。webpack版より起動が体感でかなり速いです。

## 設定2: vitest.config.ts

Vitest側は `projects` で「普通のユニットテスト」と「Storybookテスト」を分けています。

```ts
import { defineConfig } from 'vitest/config';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';

export default defineConfig({
  test: {
    projects: [
      // 普通のユニットテスト(ロジック層)
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts'],
          environment: 'node',
        },
      },
      // Storybookテスト(ストーリー → ブラウザ実行)
      {
        extends: true,
        plugins: [
          storybookTest({ configDir: path.join(dirname, '.storybook') }),
        ],
        test: {
          name: 'storybook',
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
});
```

ポイントは2つあります。

1. `storybookTest()` プラグインがストーリーファイルを読み込み、テストとして登録する。描画確認だけならストーリー側への追加は不要で、操作を検証するときはplay関数を書く
2. browser modeの `provider: playwright({})` で、テストがheadless Chromiumの中で実行される。CSSレイアウトもフォーカス管理も実ブラウザの挙動で検証される

プロジェクトを分けてあるので、ロジックのテストだけ高速に回したいときは `vitest run --project unit`、ストーリーを含めた全体は `vitest run` と使い分けられます。

## 何が嬉しいのか

**テストを書く動機とカタログを書く動機が一致します。** コンポーネントテストを別途書く運用は、1人開発だと最初に力尽きる部分です。この構成なら「開発中に見た目を確認したくてストーリーを書く」という自然な行動が、そのまま回帰テストの蓄積になります。

もう1つ、jsdomではなく実ブラウザで走ることの安心感は思ったより大きいです。ダイアログのフォーカストラップやポータルの描画のような、jsdomだと素通りor誤検知しがちな領域が普通に検証されます。

a11yアドオンを入れてあるので、Storybook上でアクセシビリティの警告も同じ画面で確認できます。カタログ・テスト・a11yチェックが1箇所に集まっている状態です。

## 注意点

- browser modeのテストは実ブラウザ起動のぶん、unitテストより明確に遅いです。だからこそprojects分割で「普段はunitだけ」を回せるようにしておくのが大事です
- play関数(インタラクションテスト)を書いていないストーリーは「レンダリングが壊れていないか」の検証になります。それでも十分価値がありますが、フォーム系など重要な部品はplay関数まで書くと効果が跳ね上がります

## 環境

- Storybook 10(@storybook/nextjs-vite)+ @storybook/addon-vitest
- Vitest + @vitest/browser-playwright(Chromium)
- Next.js 15(App Router)、Turborepo monorepo内のweb appで運用
- 設定は運用中のプロジェクトから抜粋・簡略化しています
