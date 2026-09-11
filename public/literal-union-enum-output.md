---
title: "enumをliteral unionへ変える前に、生成されるJavaScriptを確認する"
tags:
  - TypeScript
  - Node.js
private: false
updated_at: null
id: null
organization_url_name: null
slide: false
ignorePublish: true
---

状態が`"ready"`か`"waiting"`かを型で制限したいだけなら、literal unionで表せます。実行時に`State.Ready`という名前でも参照したいなら、値のオブジェクトも必要です。

`enum`、literal union、`as const`オブジェクトは、この2つの要求を分けて比べます。通常の`enum`はJavaScriptへ出力されるため、単なる型の別表記ではありません。

## 同じ状態を4通りで出力してみる

検証環境は2026年9月11日、macOS arm64、Node.js 24.15.0、TypeScript 7.0.2です。`strict: true`、`target: ES2022`、`module: ESNext`、`moduleResolution: Bundler`でビルドしました。

```ts
export enum NumericState { Ready, Waiting }
export enum StringState { Ready = "ready", Waiting = "waiting" }
export type State = "ready" | "waiting";
export const StateValue = { Ready: "ready", Waiting: "waiting" } as const;
export const selected: State = "ready";
console.log(JSON.stringify({ numeric: NumericState, string: StringState, object: StateValue, selected }));
```

ログに出た値は次のとおりです。生成されたJavaScriptも合わせて確認しました。

| 定義 | 実行時に残った内容 |
| --- | --- |
| 数値enum | `Ready: 0`、`Waiting: 1`と、`0: "Ready"`、`1: "Waiting"`の逆引き |
| 文字列enum | `Ready: "ready"`、`Waiting: "waiting"` |
| literal unionの`State` | 型定義は消える。`selected`の値`"ready"`は残る |
| `as const`オブジェクト | `Ready: "ready"`、`Waiting: "waiting"` |

数値enumに逆引きができ、文字列enumに同じ逆引きが生成されないことは、[公式のEnumsリファレンス](https://www.typescriptlang.org/docs/handbook/enums.html#reverse-mappings)とも一致します。逆引きが必要なら、数値enumが持つ実行時の機能です。使わないなら、その機能を必要条件として扱う理由はありません。

## オブジェクトから値のunionを取り出す

```ts
export const StateValue = { Ready: "ready", Waiting: "waiting" } as const;
export type State = typeof StateValue[keyof typeof StateValue];
export const value: State = "ready";
console.log(value, Object.isFrozen(StateValue));
```

ここでは名前付きの値を`StateValue`で持ち、許容値の型をそこから取り出しました。`"ready"`を`State`へ代入でき、ログは`ready false`でした。`Object.isFrozen`が`false`なのは、`as const`が実行時の凍結をしないためです。

文字列enumでは、同じ文字列だからといってそのまま代入できませんでした。

```ts
enum State { Ready = "ready", Waiting = "waiting" }
const value: State = "ready";
export {};
```

こちらはTS2322です。外部から受け取った文字列をそのままenum型として扱えるわけではありません。literal unionでも未検査の任意の文字列を安全だと認められるわけではなく、外部入力の実行時検証は別に必要です。

## `const enum`が消えるかは設定も見る

次の入力を、`isolatedModules`の有無だけ変えてコンパイルしました。

```ts
const enum State { Ready = "ready", Waiting = "waiting" }
export const value = State.Ready;
console.log(value);
```

`isolatedModules: false`では、生成JavaScriptに値がインライン化されました。

```js
export const value = "ready" /* State.Ready */;
console.log(value);
```

`isolatedModules: true`では`State`のオブジェクトを作るコードと`State.Ready`へのアクセスが残りました。どちらも実行結果は`ready`です。`const enum`なら、ビルド方式に関係なく必ずオブジェクトが消えると期待するのは避けます。

ここで比較したのは同じソースファイル内の定義と利用です。公開ライブラリの`.d.ts`にあるambient const enumや、利用側と定義側のバージョンがずれた構成までは検証していません。

## 型を消すだけの実行環境なら制約が明確になる

`erasableSyntaxOnly: true`を付けると、通常のenumとconst enumの両方がTS1294になりました。literal unionと`as const`オブジェクトの例は通ります。このオプションは、JavaScriptへの変換を必要とする構文を避けるためのものです。[公式の設定説明](https://www.typescriptlang.org/tsconfig/erasableSyntaxOnly.html)に対象構文が載っています。

Node.js 24.15.0でも、通常のenumを含む`.ts`を変換オプションなしで直接実行すると`ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`でした。[Node.jsのTypeScript対応](https://nodejs.org/download/release/v24.15.0/docs/api/typescript.html)は、型を除去する実行と、構文変換が必要な機能を区別しています。

型だけが必要ならliteral union、名前付きの値も必要ならオブジェクトからunionを導出する方法を候補にできます。既存コードがenumの逆引きや公開APIへ依存しているなら、その利用箇所を調べてから変更します。今回の出力比較だけでbundleサイズや処理速度の優劣は判断できません。

[比較入力](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/language-batch08/compiler-cases.json)のT05ケースと[コンパイル・実行結果](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/production/2026-09/batch-08/compiler-results.json)を残しました。選択肢の比較は、実行時に必要な値と、実際に使う変換設定を揃えて行います。
