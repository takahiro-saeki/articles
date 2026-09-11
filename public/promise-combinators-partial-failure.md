---
title: "Promise.all・allSettled・any・raceを、失敗が先に来る同じ入力で比べる"
tags:
  - JavaScript
  - TypeScript
  - Node.js
private: false
updated_at: null
id: null
organization_url_name: null
slide: false
ignorePublish: true
---

部分失敗のある処理では、何が起きた時点で集約したPromiseを確定したいかを決めます。`Promise.all`を`allSettled`へ変えても、処理の開始数やキャンセル方法までは変わりません。

A、B、Cの順で渡し、Bが失敗、Cが成功、最後にAが成功する入力を使って比べました。

| メソッド | Bが失敗した直後 | 全入力の確定後に観測した結果 |
| --- | --- | --- |
| `all` | reject | Bのエラー |
| `allSettled` | pending | A成功、B失敗、C成功の配列 |
| `any` | pending | 最初の成功であるCの値 |
| `race` | reject | 最初に確定したBのエラー |

検証環境は2026年9月11日のNode.js `v24.15.0`です。壁時計の速さではなく、入力を確定させる順序を固定して確認しています。

## タイマーを使わずに完了順を指定する

`Promise.withResolvers()`を使うと、Promiseと、その外から呼べる`resolve`、`reject`を一緒に取得できます。比較用の核になるコードは次のとおりです。

```js
const a = Promise.withResolvers();
const b = Promise.withResolvers();
const c = Promise.withResolvers();

const result = Promise.allSettled([a.promise, b.promise, c.promise]);
b.reject(new Error("B failed"));
c.resolve("C result");
a.resolve("A result");

console.log(await result);
```

ここでは実通信を行っていません。`allSettled`の結果は完了順のB、C、Aではなく、渡した順のA、B、Cになります。元の入力と結果を対応させたいバッチで、この順序を使えます。

[全比較の再現コード](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/promise-combinators.mjs)では4メソッドを別々に実行し、Bの失敗後の状態と最終結果をassertで確認しています。

```bash
node experiments/article-stock-2026-09/promise-combinators.mjs
```

仕様上の判定は[ECMAScriptのPromise各メソッド](https://tc39.es/ecma262/multipage/control-abstraction-objects.html#sec-promise.all)でも確認しました。配列として普通のPromiseを渡す今回の比較と、入力のiterator自体が例外を投げる場合は分けて考えます。

## rejectしたあとも、残りの入力は存在する

実験では、`all`と`race`がBのエラーでrejectしたあとも、CとAを成功へ確定できました。集約側の失敗によって、入力側のPromiseがキャンセルされる動きはありません。

実際の通知処理なら、すでに送信したリクエストがあるかもしれません。`all`のcatchへ入ったことを理由に全件をもう一度送ると、成功した分まで再送するおそれがあります。結果の集約と、各処理を止めたり再試行したりする方針は別に設計します。

`race`も同様です。タイムアウト用のPromiseが先に確定しても、競争相手の通信は自動では止まりません。停止させるなら処理側が対応するキャンセル手段を別に渡します。今回はキャンセル可能なfetchやタイマーの実装は対象にしていません。

## 同期throwは、allSettledの外で起きることがある

次の書き方では、配列を作る途中で例外が出ます。

```js
const jobs = [
  () => 1,
  () => { throw new Error("sync failure"); },
  () => 3,
];

await Promise.allSettled(jobs.map(job => job()));
```

`map`が終わらないため、`allSettled`へ入力を渡すところまで進みません。全ジョブの失敗を結果として回収したい場合は、各呼び出しをPromiseの中へ入れます。

```js
const results = await Promise.allSettled(
  jobs.map(job => Promise.resolve().then(job)),
);
```

この形では、結果のstatusは`fulfilled`、`rejected`、`fulfilled`になりました。`allSettled`が同期throwを特別に捕まえたのではなく、`then`内で起きた例外が入力Promiseのrejectionになったためです。

ただし、これも並列数の制限にはなりません。実行したい関数をPromiseの中へ移しただけなので、大量のジョブを同時に開始したくない場合は、別にワーカー数やキューを決めます。

## 空配列も呼び出し側の仕様に含める

空配列では、`all`と`allSettled`は空の配列でfulfillします。`any`は`errors`が空の`AggregateError`でrejectし、`race`はpendingのままです。これも同じスクリプトで確認しました。

たとえば候補サーバーの配列が空になる可能性があるなら、`race`へそのまま渡すと結果が返りません。入力0件を成功と見なすか、入力不足としてエラーにするかを先に決めます。

この比較では、全件の結果が必要な処理には`allSettled`、全件成功を要求する集約には`all`、どれか一つの成功があればよい処理には`any`、成功・失敗を問わず最初の確定を見る処理には`race`が対応しました。保存済み結果の扱いやキャンセルまで、メソッド名一つで決まるわけではありません。
