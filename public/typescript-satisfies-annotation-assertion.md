---
title: "TypeScriptのsatisfies・型注釈・asを、推論結果と欠落チェックで比べる"
tags:
  - TypeScript
private: false
updated_at: null
id: null
organization_url_name: null
slide: false
ignorePublish: true
---

`satisfies`は、設定値が型を満たすか確かめながら、各プロパティの具体的な型を使いたいときに役立ちます。ただし「何を付けても推論は一切変わらない」「余分なキーを必ず拒否する」と覚えると、実際の診断と食い違います。

同じオブジェクトを型注釈、`satisfies`、`as`で宣言し、生成された`.d.ts`とエラーを比べました。結論を先に置くと、今回の表示設定では次の違いがありました。

| 書き方 | `ready`を読むときの型 | `waiting`の欠落 |
| --- | --- | --- |
| `: Notices` | `string | number[]` | エラー |
| `satisfies Notices` | `string` | エラー |
| `as Notices` | `string | number[]` | この例では通る |

## 推論は補完表示だけで判断しない

検証環境は2026年9月11日、macOS arm64、Node.js 24.15.0、TypeScript 7.0.2です。`strict: true`、`target: ES2022`、`module: ESNext`、`moduleResolution: Bundler`で、型検査とdeclaration出力を実行しました。値は比較用に作った表示設定です。

```ts
type Notices = Record<"ready" | "waiting", string | number[]>;
export const annotated: Notices = { ready: "Ready", waiting: [1, 2] };
export const checked = { ready: "Ready", waiting: [1, 2] } satisfies Notices;
export const asserted = { ready: "Ready", waiting: [1, 2] } as Notices;
console.log(checked.ready.toUpperCase());
```

`checked.ready.toUpperCase()`は通り、実行結果は`READY`でした。`annotated.ready`へ同じメソッド呼び出しを書くと、配列の可能性が残るためTS2339です。

生成された宣言を見ると、呼び出し可否の理由が分かります。

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

`checked`には各プロパティの型が残り、他の2つは`Notices`という注釈の型になります。`satisfies`なら許容する値の種類をまとめて検査し、個別の値を使う箇所で余分な絞り込みをせずに済みます。[TypeScript 4.9の説明](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html)でも、式の型を扱いやすいまま適合性を調べる用途が示されています。

## `as`を検査の代わりにすると欠落が残る

```ts
type Notices = Record<"ready" | "waiting", string | number[]>;
const value = { ready: "Ready" } as Notices;
console.log(value.waiting);
```

このコードは型検査を通り、`undefined`を出力しました。同じ値を`satisfies Notices`へ変えると、`waiting`欠落のTS2741になります。`as`でプロパティが作られるわけではありません。

一方、`as`なら任意の変換が全部通る、という意味でもありません。TypeScriptは型同士の関係によってアサーションを拒否します。ここで確認したのは、必須キーの欠落があるこの具体例を通すことです。[型アサーションの公式説明](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#type-assertions)にあるとおり、実行時の値の検査や変換にはなりません。

## 「推論を変えない」には文脈がある

```ts
export const plain = { enabled: true, count: 1 };
export const checked = { enabled: true, count: 1 } satisfies { enabled: boolean; count: number };
export const frozenType = { enabled: true, count: 1 } as const;
```

この宣言出力では、`plain.enabled`は`boolean`、`checked.enabled`は`true`でした。`count`はどちらも`number`です。対象型から受ける文脈によって、リテラルの扱いまで完全に同一とは限りません。

`as const`を付けた`frozenType`では、`enabled`が`readonly`な`true`、`count`が`readonly`な`1`になりました。これも実行時にオブジェクトを凍結する操作ではありません。設定をあとで書き換える設計なら、`true`に狭まったプロパティへ`false`を入れたいのか、最初から`boolean`を受け入れたいのかを分けて考えます。

## 余分なキーを拒否する範囲

`{ ready: "Ready", waiting: [1], typo: 1 } satisfies Notices`を直接書くと、余分な`typo`にTS2353が出ました。ところが、その値を先に変数へ入れると結果が変わります。

```ts
type Notices = Record<"ready" | "waiting", string | number[]>;
const input = { ready: "Ready", waiting: [1], typo: 1 };
const value = input satisfies Notices;
console.log(value.typo);
```

こちらは通り、`1`を出力します。必要なプロパティを持つ値として適合しても、余分なプロパティを取り除きません。外部データのキーを制限したい場合は、型構文とは別に実行時の検査が必要です。

この実験で選ぶ基準は、ローカルな設定の誤りを検出し、値ごとの操作を残したいなら`satisfies`、変数に持たせる型を明示したいなら型注釈です。`as`は、その型だと判断できる別の根拠がある箇所に限って使います。

[再現コード](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/language-batch08/compiler-cases.json)のT02ケースと[実行記録](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/production/2026-09/batch-08/compiler-results.json)には、成功した宣言と意図的に失敗させた入力の両方を残しました。診断番号や推論結果を別バージョンへそのまま一般化せず、更新時は宣言出力も比べてください。
