---
title: "structuredCloneとJSON往復コピーを、値と参照の壊れ方で比べる"
tags:
  - JavaScript
  - Node.js
private: false
updated_at: null
id: null
organization_url_name: null
slide: false
ignorePublish: true
---

`JSON.parse(JSON.stringify(value))`でオブジェクトをコピーすると、コピー処理そのものは成功してもデータの意味が変わることがあります。Dateが文字列になるだけでなく、Mapの中身や、同じオブジェクトを指していた関係も変わりました。

Node.js 24.15.0で両方を比較しました。コピーしたい値の種類と、コピー後にも保ちたい参照関係を先に決めます。

## 値と参照を同時に確かめる

例は記事の下書きを模した合成データです。実ユーザーのレコードではありません。検証日は2026年9月11日で、JSON往復にはreplacer、reviver、独自の`toJSON`を追加していません。

```js
const row = { id: 'draft-1', status: 'ready' };
const source = {
  createdAt: new Date('2026-09-11T00:00:00.000Z'),
  counts: new Map([['ready', 2]]),
  memo: undefined,
  slots: [undefined],
  left: row,
  right: row,
};
const cloned = structuredClone(source);
const jsonCopy = JSON.parse(JSON.stringify(source));
console.log(cloned.createdAt instanceof Date, typeof jsonCopy.createdAt);
console.log(cloned.counts.get('ready'), jsonCopy.counts);
console.log(Object.hasOwn(cloned, 'memo'), Object.hasOwn(jsonCopy, 'memo'));
console.log(cloned.slots[0], jsonCopy.slots[0]);
console.log(cloned.left === cloned.right, jsonCopy.left === jsonCopy.right);
```

実行すると次のログになりました。

```text
true string
2 {}
true false
undefined null
true false
```

`structuredClone`側のDateとMapは、それぞれの型として使えます。JSON側ではDateが文字列、Mapが空のオブジェクトになりました。また、オブジェクトの`memo: undefined`はJSON側から消え、配列内の`undefined`は`null`になりました。

最後の行もコピーの目的によっては見落とせません。元の`left`と`right`は同じ`row`です。`structuredClone`ではコピー先でも同じオブジェクトを指しますが、JSON往復では別々のオブジェクトになりました。どちらも元の`row`そのものを共有するわけではありません。[HTML仕様のstructured serialization](https://html.spec.whatwg.org/multipage/structured-data.html#structuredserializeinternal)は、同じオブジェクトを重複して処理しない記録を使い、循環や参照の同一性を保つ手順を定義しています。

## 成功したというだけではコピーの意味を確認できない

入力を分けて12ケースを調べました。次の表は代表的な結果です。

| 入力 | structuredClone | JSON往復 |
| --- | --- | --- |
| Date | Date | ISO形式の文字列 |
| Map | エントリーを持つMap | 空のオブジェクト |
| オブジェクト内のundefined | キーも値も保持 | キーが消える |
| 配列内のundefined | undefinedの要素 | nullの要素 |
| NaN、Infinity、-0 | 各値の性質を保持 | null、null、0 |
| 同じ子を指す2プロパティ | コピー先でも同じ子を共有 | コピー先では別々の子 |
| 循環参照 | コピー先でも循環 | TypeError |
| BigIntを含むオブジェクト | bigintの値を保持 | TypeError |
| 関数プロパティを持つオブジェクト | DataCloneError | 関数のキーが消える |

JSON往復のうち、関数やundefinedが消えたケースは例外になりませんでした。エラーの有無だけを見るテストでは、この変化を拾えません。[ECMAScriptのJSON仕様](https://tc39.es/ecma262/multipage/structured-data.html#sec-json.stringify)でも、値の種類やオブジェクト・配列の位置によってシリアライズの扱いが分かれています。

比較では、`instanceof`、`Object.hasOwn`、`Object.is`、参照の`===`を使い分けました。JSON文字列だけを比較すると、JSONにした時点で失われる性質を検査できません。

## structuredCloneもインスタンスの完全複製ではない

残る3ケースでは、クラス、凍結状態、getterを調べました。

自作の`Draft`クラスをコピーすると、通常のデータプロパティ`title`は残りましたが、`instanceof Draft`は`false`で、prototypeの`label()`メソッドもありませんでした。JSON往復も同じ観測結果です。

`Object.freeze({ count: 1 })`から作ったコピーは、どちらも凍結されておらず、`count`は書き込み可能でした。getterのあるオブジェクトでは、どちらも値を読む際にgetterが動き、コピー先には値`2`を持つ通常のプロパティができました。両方式を1回ずつ実行してgetterは合計2回呼ばれています。

この結果から、ドメインオブジェクトの振る舞いまで複製する目的には、そのクラス用の生成処理が必要だと判断できます。今回のクラスをコピーしても、同じメソッドが呼べるインスタンスには戻りませんでした。

## transferは元のバッファを使い続けるコピーではない

```js
const bytes = new Uint8Array([1, 2, 3]);
const moved = structuredClone(bytes, { transfer: [bytes.buffer] });
console.log(bytes.byteLength, [...moved]);
```

これは`0 [ 1, 2, 3 ]`を出力しました。転送先には値が残り、元のArrayBufferは切り離されています。別の処理でも元バッファを使うつもりなら、通常のコピーと同じ扱いにはできません。[Node.jsのstructuredClone](https://nodejs.org/download/release/v24.15.0/docs/api/globals.html#structuredclonevalue-options)は、この転送オプションを持つWHATWGのAPIです。

今回測ったのは値・参照・例外の違いです。速度、大きなデータのメモリ使用量、DOM要素などのブラウザ固有オブジェクトは比較していません。JSONで受け渡す仕様があるなら、その形式へ変換する設計は引き続き必要です。メモリ上のコピー用途へJSON往復を流用するときに、何が変わってよいかを確認するための実験です。

[実行スクリプト](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/language-batch08/run-runtime.mjs)と[12ケース・転送の結果](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/production/2026-09/batch-08/clone-results.json)には、成功だけでなくコピー先の形も記録しています。
