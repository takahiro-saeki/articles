---
title: "import typeを省くと何が残るか。tscとesbuildで副作用まで比較する"
tags:
  - TypeScript
  - JavaScript
  - esbuild
private: false
updated_at: null
id: null
organization_url_name: null
slide: false
ignorePublish: true
---

`import type`を省いても、型としてしか使わないimportが自動で消える設定はあります。一方、`verbatimModuleSyntax: true`では書き方によって副作用の実行まで変わりました。型検査に通るかと、読み込み先が実行されるかを分けて確認します。

特に注意したいのは、次の2つが常に同じ出力になるわけではない点です。

- `import type { Ticket } from "./registry.js"`
- `import { type Ticket } from "./registry.js"`

## 読み込み先に目印だけを置く

検証環境は2026年9月11日、macOS arm64、Node.js 24.15.0、TypeScript 7.0.2、esbuild 0.28.2です。コンパイラは`strict: true`、`target: ES2022`、`module: ESNext`、`moduleResolution: Bundler`。esbuildはNode向けESM、bundle有効、tree shaking有効で実行しました。テストパッケージに`sideEffects: false`は付けていません。

`registry.ts`には型と、評価されたことを示すログだけを置きます。外部アクセスや実アプリの初期化処理はありません。

```ts
export interface Ticket { title: string }
console.log("registry evaluated");
```

呼び出し元の基本形は次のコードです。

```ts
import { Ticket } from "./registry.js";
const ticket: Ticket = { title: "Fix timer" };
console.log(ticket.title);
```

このimportだけを書き換え、生成JavaScriptと実行ログを比較しました。実際の個人リポジトリでも、[型共有パッケージ](https://github.com/takahiro-saeki/circle-hub/blob/770de5f2989775cfd95f7a9c4529565a2b48d2fd/packages/api/src/index.ts)は`export type`でAPIの型を公開しています。今回の`Ticket`とログは、型の参照と実行時の読み込みを切り分けるために用意した最小例です。

## 書き方と設定で結果が分かれた

表の「評価」は、`registry evaluated`が出力されたことを指します。どの成功例も、呼び出し元は`Fix timer`を出力しました。

| importの形 | verbatim | tsc | tsc出力でregistry評価 | esbuild bundleでregistry評価 |
| --- | --- | --- | --- | --- |
| `import { Ticket }` | false | 成功 | なし | なし |
| `import type { Ticket }` | false | 成功 | なし | なし |
| `import { type Ticket }` | false | 成功 | なし | なし |
| 副作用import + `import type` | false | 成功 | あり | あり |
| `import { Ticket }` | true | TS1484 | 出力を止めた | あり |
| `import type { Ticket }` | true | 成功 | なし | なし |
| `import { type Ticket }` | true | 成功 | あり | あり |
| 副作用import + `import type` | true | 成功 | あり | あり |

`noEmitOnError: true`を指定しているため、TS1484の行ではtscのJavaScriptを実行していません。esbuildはその入力をbundleできましたが、型検査が通ったことにはなりません。

## inlineのtypeは空のimportを残した

`verbatimModuleSyntax: true`で`import { type Ticket }`と書いたケースのtsc出力です。

```js
import {} from "./registry.js";
const ticket = { title: "Fix timer" };
console.log(ticket.title);
```

`Ticket`という名前は消えても、`import {} from "./registry.js"`が残ります。モジュールを評価する依存はあるため、目印のログが出ました。文全体を型専用にした`import type { Ticket }`では、import文ごと消えてログも出ませんでした。[verbatimModuleSyntaxの公式説明](https://www.typescriptlang.org/tsconfig/verbatimModuleSyntax.html)も、この2つの出力を区別しています。

型だけが必要なら文全体を`import type`にします。初期化も必要な場合は、それを別のimportとして明示できます。

```ts
import "./registry.js";
import type { Ticket } from "./registry.js";
const ticket: Ticket = { title: "Fix timer" };
console.log(ticket.title);
```

この形は今回の両設定と両ツールでログを出しました。ただし、依存パッケージが副作用なしと宣言している場合や、別のbundle設定でも同じになるとは限りません。ここで観測したのはローカルの2ファイルです。

## bundleができても型は確かめられていない

```ts
export const count: number = "wrong";
console.log(typeof count);
```

これはtscでTS2322になりましたが、esbuildは成功し、実行結果は`string`でした。esbuildの[TypeScriptに関する制約](https://esbuild.github.io/content-types/#typescript-caveats)でも、型注釈の検査はTypeScriptの型チェッカー側で行うことを説明しています。

型だけの依存を明示することと、型チェックをビルド工程で実行することは別の対策です。今回の再現では、importの削除だけを見れば動く入力でも、tscが検出する誤りをbundle成功だけでは拾えませんでした。

[比較入力](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/language-batch08/compiler-cases.json)のT06ケースを[実行スクリプト](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/language-batch08/run-compiler.mjs)で処理すると、[診断・生成JavaScript・ログ](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/production/2026-09/batch-08/compiler-results.json)をまとめて確認できます。アプリへ設定を導入するときも、型専用の参照と初期化目的の読み込みをそれぞれ確認します。
