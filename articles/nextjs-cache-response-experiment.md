---
title: "Next.js 16のキャッシュを、レスポンスと取得回数で見分ける"
emoji: "🗂️"
type: "tech"
topics: ["nextjs", "react", "cache", "frontend"]
published: false
---

画面を開き直しても同じ値が出るとき、どのキャッシュが効いているのでしょうか。`fetch`の結果を再利用している場合も、ページの出力を再利用している場合もあります。ブラウザの戻る操作では、サーバーへ取りに行っていない可能性もあります。

今回は取得元に連番を付け、同じ値が見える理由を分けて確認しました。画面の値に加えて、**取得元へ届いた回数と、どの操作でその回数が増えたかを記録します**。

## まず対象のキャッシュモデルを固定する

検証日は2026年9月11日です。Next.js 16.3.4、Node.js 24.15.0、`next build --webpack`と`next start`を使いました。`cacheComponents: false`、React CompilerなしのApp Routerです。React依存は19.2.5ですが、Next.js同梱のApp Router向けReact / React DOMは`19.3.0-canary-cbb046ab-20260731`です。

現行の公式ドキュメントは、[Cache Componentsを使わない従来モデル](https://nextjs.org/docs/app/guides/caching-without-cache-components)を別ページで説明しています。この記事の結果を、Cache Components有効時やすべてのNext.jsアプリの既定動作へ広げません。

従来の整理で使われるRequest Memoization、Data Cache、Full Route Cache、Router Cacheは、対象も寿命も異なります。ここではその名前を、次の観測へ対応させます。

| 呼び方 | 今回区別する再利用 |
| --- | --- |
| Request Memoization | 一回のReactレンダー内で同じ取得をまとめる |
| Data Cache | 別のHTTPリクエストでも取得結果を再利用する |
| Full Route Cache | build時などに作ったrouteの出力を再利用する |
| Router Cache | クライアント遷移で取得済みのroute情報を再利用する |

「キャッシュは全部で四つ」と数え切る表ではありません。CDN、通常のHTTPキャッシュ、取得元のキャッシュなどは今回の環境から外しています。

## 取得元へ届くたびに増える数字を返す

ローカルのHTTPサーバーは、パスごとにカウンターを持ちます。初回なら`{"key":"memo","count":1}`、次に同じパスへ届けばcountが増えます。キャッシュ実験のmemo、data、fullは別のパスを使い、互いの数字を混ぜません。

Next.js側の取得関数は共通です。

```js
export async function readProbe(key, cache) {
  const response = await fetch(`${process.env.ARTICLE_ORIGIN}/${key}`, { cache });
  if (!response.ok) throw new Error(`Probe status ${response.status}`);
  return response.json();
}
```

比較ごとに空の`.next`からbuildして、以前のData Cacheを引き継がないようにしました。取得元はbuild中も起動し、build時に増えた回数を記録します。build後に数字をゼロへ戻して、すでに保存された結果と食い違わせる方法にはしていません。

この関数は認証、POST、AbortSignalなどを使いません。同じURLとオプションのGETを、ReactのServer Componentから二度呼ぶ条件です。

## 同じレンダー内と、次のリクエストを分ける

最初のPageは`no-store`で取得します。`connection()`より後をリクエスト時の処理にして、route全体の事前生成と区別しました。[connectionの公式説明](https://nextjs.org/docs/app/api-reference/functions/connection)に沿った使い方です。

```jsx
import { connection } from 'next/server';
import { readProbe } from '../../../lib/probe';
export default async function Page() {
  await connection();
  const values = await Promise.all([readProbe('memo', 'no-store'), readProbe('memo', 'no-store')]);
  return <pre id="result">{JSON.stringify(values)}</pre>;
}
```

各routeへ直接HTTP GETを3回送りました。表の表示値は、返った二つのオブジェクトからcountだけを抜き出しています。

| routeの条件 | build中の取得元到達 | GET 3回中の追加到達 | 各レスポンスのcount |
| --- | ---: | ---: | --- |
| connection + no-store | 0 | 3 | [1,1]、[2,2]、[3,3] |
| connection + force-cache | 0 | 1 | [1,1]、[1,1]、[1,1] |
| connectionなし + force-cache | 1 | 0 | [1,1]、[1,1]、[1,1] |

`no-store`でも、一回のレスポンスでは同じcountを二つ受け取りました。取得元への到達は一回です。次のHTTPリクエストではcountが増えています。ここで見えたのが、レンダー内の重複取得の再利用です。

`connection()`を残し、取得だけ`force-cache`にしたrouteは、最初のリクエストで取得した値を次のリクエストでも返しました。build一覧では動的routeのままです。動的レンダーだから取得データも毎回新しい、とは判断できません。

## 同じ値でも、routeの出力を再利用したケースがある

最後のrouteは`connection()`を取り除き、`force-cache`の取得を二度行います。この比較アプリではbuild時に静的生成されました。取得元への一回の到達もbuild中に発生しています。

`next start`へ送った3回のレスポンスはいずれも`x-nextjs-cache: HIT`でした。一方、動的routeである前の二つにはこのヘッダーがありませんでした。それでもdataのrouteは取得結果を再利用しています。

したがって、ヘッダーがないだけでData Cacheも使われていないとは言えません。逆に、同じcountを返しただけでFull Route Cacheだとも言えません。buildの分類、レスポンスヘッダー、取得元の回数を合わせると、今回の二つを区別できます。

この実験ではTTLの経過、再検証、複数サーバー間の共有は試していません。同じNodeプロセスで短い間隔のリクエストを送った結果です。

## ブラウザの「戻る」は別に試す

クライアント遷移用のrouteは、`connection()`と`no-store`を使った単一取得です。`Link`のprefetchを無効にし、Playwrightで操作しました。

| 操作 | 表示count | 取得元への累計到達 |
| --- | ---: | ---: |
| routeへ直接入る | 1 | 1 |
| LinkでHomeへ移り、ブラウザで戻る | 1 | 1 |
| router.refresh() | 2 | 2 |
| Homeへ移り、Linkで再びrouteを開く | 3 | 3 |

戻ったときには取得元の数字が増えませんでした。同じURLへ新しくLinkで進む操作では増えています。これを単に「二回目はキャッシュ」と説明すると、操作による差が消えてしまいます。

`router.refresh()`で新しい値になったのは、今回は取得を`no-store`にしたためです。[useRouterの公式説明](https://nextjs.org/docs/app/api-reference/functions/use-router)では、refreshはサーバー側のキャッシュを無効化しないと説明されています。`force-cache`を使う実画面でも必ず新しい値になるという結果ではありません。

## 原因を追うための最小記録

[実験アプリと計測コード](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/run-next-batch07.py)は、buildログ、レスポンス、取得元の回数を別々に保存します。ブラウザはHeadlessChrome 152.0.0.0、Playwright CLI 0.1.19です。外部APIや本番のデータは使っていません。

実画面で値が古いときは、まず同一レンダー内の重複なのか、別のHTTPリクエストなのか、ブラウザの戻る操作なのかを記録します。その条件を固定してから取得元の到達を見ると、`no-store`や`router.refresh()`を無差別に足さずに、調べる層を絞れます。
