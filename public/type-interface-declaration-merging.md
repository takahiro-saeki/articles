---
title: "typeとinterfaceは、宣言の追加と競合時のエラーで使い分ける"
tags:
  - TypeScript
private: false
updated_at: null
id: null
organization_url_name: null
slide: false
ignorePublish: true
---

`type`と`interface`を選ぶときは、あとから同じ名前へ宣言を追加してよい契約なのかを先に決めると整理できます。普通のオブジェクト型は両方で表せますが、同名宣言の追加と、競合するプロパティを合成したときの診断は同じではありません。

最小コードをTypeScript 7.0.2でコンパイルすると、次の結果になりました。

| 操作 | 結果 |
| --- | --- |
| 同名`interface`へ別プロパティを追加 | 統合され、追加プロパティも必須になる |
| 同名`type`を再宣言 | TS2300 |
| `interface extends`で`id: string`を`id: number`へ変更 | 継承の宣言でTS2430 |
| `{ id: string } & { id: number }`を定義 | 定義は通り、`id`は`never`になる |
| そのintersectionへ`{ id: 1 }`を代入 | 代入箇所でTS2322 |

## 同名interfaceは既存の利用者にも影響する

```ts
export interface Ticket { title: string }
export interface Ticket { traceId: string }
export const ticket: Ticket = { title: "Fix timer", traceId: "local-1" };
console.log(ticket.traceId);
```

これはコンパイルも実行も通り、`local-1`を出力します。後半の宣言は別名の派生型を作らず、同じ`Ticket`へメンバーを追加します。`traceId`を省いた利用側のオブジェクトはTS2741になりました。

公式の[Declaration merging](https://www.typescriptlang.org/docs/handbook/declaration-merging.html)では、同名interfaceのメンバー統合と、同じ非関数メンバーを再宣言する場合の型一致条件を説明しています。今回のコードは、そのうち異なるプロパティを足す場合の再現です。

ライブラリが利用者向けに拡張点を用意するなら、この性質を契約として使えます。ただし「あとから必須メンバーを足す」ことは既存コードの型検査も変えます。任意のファイルで偶然同じ名前を書けば、無条件で全プロジェクトへ混ざるという話ではありません。宣言が同じ対象へ解決されるスコープが前提で、実際のライブラリ拡張ではmodule augmentationなどの仕組みも確認します。

今回の例は単一モジュール内の合成実験で、特定ライブラリへの拡張を実装したものではありません。

## 名前を再宣言できないことと、値を厳密に制限することは別

```ts
type Ticket = { title: string };
type Ticket = { traceId: string };
export {};
```

同じモジュール内でこの2つを定義すると、両方の宣言にTS2300が出ます。ただし、`type`を使えばオブジェクトの余分なキーが常に拒否される、という意味ではありません。

```ts
type Ticket = { title: string };
const input = { title: "Fix timer", debug: true };
const ticket: Ticket = input;
console.log("debug" in ticket);
```

このコードは通り、`true`を出力しました。型注釈が実行時の`debug`を消すこともありません。型エイリアスを再度開いて宣言を統合できない性質と、値が構造的に代入可能かどうかは別です。[Everyday types](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#differences-between-type-aliases-and-interfaces)には、型エイリアスとinterfaceの共通点と宣言統合の違いが載っています。

## 合成時の競合は、どこで失敗するかを見る

```ts
interface TextId { id: string }
interface NumericId extends TextId { id: number }
export {};
```

この継承は`NumericId`の宣言で失敗します。`id`を数値へ置き換えたため、元の`TextId`を満たしません。

一方、intersectionは両方の条件を同時に要求します。

```ts
type TextId = { id: string };
export type Combined = TextId & { id: number };
type IsNever<T> = [T] extends [never] ? true : false;
export const check: IsNever<Combined["id"]> = true;
console.log(check);
```

こちらは定義だけなら通りました。小さな条件型で調べると`Combined["id"]`は`never`で、`check`の値`true`も型検査を通ります。`string`と`number`の両方を満たす値を入れようとしているためです。

この`Combined`へ`{ id: 1 }`を代入した段階でTS2322が出ました。`&`は同名プロパティを右側の型で上書きする演算ではありません。合成後の型を宣言できても、使える値があるとは限りません。

## 今回の結果から決める範囲

宣言統合を利用者向けの拡張点にするなら`interface`が候補になります。unionのように複数の選択肢へ名前を付ける場合は`type`を使います。どちらでも表せるアプリ内のオブジェクト型は、既存のコード規約に揃えて構いません。今回の実験から、一律に片方へ書き換える理由は得られませんでした。

検証は2026年9月11日、macOS arm64、Node.js 24.15.0、TypeScript 7.0.2、`strict: true`、`target: ES2022`、`module: ESNext`、`moduleResolution: Bundler`で行いました。型宣言は生成JavaScriptから消え、オブジェクトやログ出力のコードは残りました。型検査時間の優劣や大規模なmodule augmentationは測っていません。

[再現コード](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/language-batch08/compiler-cases.json)のT04ケースと[診断・生成物](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/production/2026-09/batch-08/compiler-results.json)で、エラーが宣言時と代入時のどちらに出るかを確認できます。
