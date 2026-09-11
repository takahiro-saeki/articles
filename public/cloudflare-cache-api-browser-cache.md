---
title: "Workersのキャッシュを消しても応答が変わらない。ブラウザ側の保存と分けて確認する"
tags:
  - CloudflareWorkers
  - HTTP
  - キャッシュ
  - JavaScript
private: false
updated_at: null
id: null
organization_url_name: null
slide: false
ignorePublish: true
---

WorkersのCache APIから応答を削除しても、ブラウザのHTTPキャッシュまでは消えません。応答内容だけを見ると削除に失敗したように見えるので、Workerへ届いた回数と、元データを取得した回数を分けて確認します。

ローカルのworkerdと実ブラウザを使い、保存場所を変えた4条件を比較しました。両方で保存した条件では、Workers側の削除がtrueを返した後も、ブラウザは同じ応答を使い続けました。

## 保存場所ごとに、通過回数を数える

検証日は2026年9月11日です。macOS 26.6.2、Node.js 24.15.0、Wrangler 4.131.0、Miniflare 5.20260910.0-alpha、workerd 1.20260910.1、HeadlessChrome 152を使いました。Workerのcompatibility_dateは2026-09-11です。

比較用Workerは、リクエストを受けた回数と、代替Service Bindingからデータを取得した回数を記録します。取得のたびにgeneration-1、generation-2と本文を変える、今回作った再現コードです。実サービスのキャッシュ設定を変更したものではありません。

[比較用Workerとハーネス](https://github.com/takahiro-saeki/articles/tree/codex/article-stock-2026-09/experiments/article-stock-2026-09/workers-batch15)の依存を入れ、リポジトリのルートから`node experiments/article-stock-2026-09/workers-batch15/run.mjs`を実行すると、HTTPサーバーが127.0.0.1:9916で動きます。ブラウザでそのページを開き、次のコードを実行すると、両方で保存する条件の本文と到達回数を読めます。試験後はサーバーをCtrl+Cで止めます。

```js
const url = '/data?mode=both&run=' + crypto.randomUUID();
const first = await (await fetch(url)).text();
const second = await (await fetch(url)).text();
const { counts } = await (await fetch('/inspect', { cache: 'no-store' })).json();
console.log({ first, second, counts: counts[new URL(url, location.href).href] });
```

同じURLへブラウザから通常のfetchを2回行った結果です。条件ごとに異なるURLを使い、前の結果が混ざらないようにしました。

| 保存する場所 | Worker到達回数 | 元データ取得回数 | 2回の本文 |
| --- | ---: | ---: | --- |
| どちらにも保存しない | 2 | 2 | generation-1、generation-2 |
| Workers Cache APIだけ | 2 | 1 | 両方generation-1 |
| ブラウザHTTPキャッシュだけ | 1 | 1 | 両方generation-1 |
| 両方 | 1 | 1 | 両方generation-1 |

本文が同じでも、Workerに届いて保存済み応答を読んだ場合と、Workerに届かなかった場合があります。本文一致だけでは、どちらが効いたかを区別できません。

## Workersへ保存する応答と、ブラウザへ返す応答

Workersだけで保存する条件では、Cache APIへ渡す応答にpublic, max-age=60を付けます。その後、ブラウザへ返す方にはno-storeを付けました。保存時と返却時でヘッダーを分けるコードです。

```js
const stored = new Response('synthetic', {
  headers: { 'Cache-Control': 'public, max-age=60' },
});
await caches.default.put(key, stored.clone());
const client = new Response(stored.body, stored);
client.headers.set('Cache-Control', 'no-store');
return client;
```

keyは対象URLのGET Requestです。この抜粋は保存と返却ヘッダーを分ける部分で、一覧表の実験では前段にcache.matchも置いています。保存用のResponseをcloneし、返却用と本文の消費を分けています。

ブラウザだけの条件ではCache APIへ書き込まず、返却応答にprivate, max-age=60を付けました。[RFC 9111の保存条件](https://httpwg.org/specs/rfc9111.html#storing.responses)では、privateは共有キャッシュの保存を制限し、no-storeは保存しない条件です。この実験の本文は公開可能な合成値で、利用者ごとのデータや認証付き応答を共有保存する例ではありません。

[Workers Cache APIの公式仕様](https://developers.cloudflare.com/workers/runtime-apis/cache/)も、putへ渡されたResponseのCache-Controlを扱います。どのResponseにヘッダーを設定したかまで見ます。

## deleteがtrueでも、次のfetchがWorkerへ来るとは限らない

両方へ保存した条件で、次の順に操作しました。

1. 通常のfetchを2回行う。Workerへの到達は1回、元データ取得も1回。
2. 同じキーをWorkers Cache APIから削除する。deleteはtrue。
3. ブラウザから通常のfetchをもう一度行う。本文はgeneration-1、到達回数はまだ1回。
4. fetchにcache: 'reload'を指定する。Workerへ到達し、generation-2を取得する。

今回のreload指定では、ブラウザにある応答をそのまま再利用せず、ネットワークを通した結果を確認できました。キャッシュ削除後に通常のfetchだけを繰り返すと、Workers側へ届かないまま同じ本文を見る場合があります。

Workersだけで保存する条件では、削除後の通常のfetchがWorkerへ届き、元データ取得回数も2へ増えました。一方、ブラウザだけの条件ではWorkers側のdeleteはfalseでしたが、ブラウザの保存済み本文は引き続き使えました。

## putが解決したことだけでは、保存を確認できない

Cache APIへ渡すResponseのヘッダーも、別の3条件で比較しました。

| Cache-Control | putの返り値 | 直後のmatch |
| --- | --- | --- |
| no-store | undefined | 見つからない |
| private, max-age=60 | undefined | 見つからない |
| public, max-age=60 | undefined | 見つかる |

今回のローカル環境では、いずれもputのPromiseは解決しました。[公式仕様](https://developers.cloudflare.com/workers/runtime-apis/cache/)も、putが解決する値だけから保存成功を判定できるとはしていません。保存確認には、同じキーでのmatchと返却内容を使います。

この比較は直後の読み取りです。保存領域からの追い出し、期限後の再取得、複数拠点でのヒット率までは測っていません。

## ブラウザのCacheStorageは、HTTPキャッシュとも別

ブラウザには、JavaScriptからcaches.openで操作するCacheStorageもあります。今回のページではService Workerを登録せず、CacheStorageへno-store付きの合成Responseを明示的にputしました。

そのResponseはcache.matchで読めましたが、同じURLへの通常のネットワーク取得は別の本文を返しました。JavaScriptが保存したResponseが、何もしなくてもHTTPリクエストへ使われるわけではありません。試験後に作成したCacheStorageは削除しました。

WorkersのCache API、ブラウザのHTTPキャッシュ、ブラウザのCacheStorageは、それぞれ保存先と読み取り経路が異なります。今回の4条件の表が扱うブラウザ側の保存は、HTTPキャッシュです。

Cloudflare上のCache APIは、公式仕様では拠点をまたいで内容が自動複製されず、deleteも実行した拠点が対象です。今回はローカルの1ランタイムで比較しているため、Cloudflareの各拠点やTiered Cacheは検証していません。まず到達回数を見れば、削除結果とブラウザの応答が食い違う理由を切り分けられます。
