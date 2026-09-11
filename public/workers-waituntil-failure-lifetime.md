---
title: "WorkersのwaitUntilで202を返した後、失敗と完了はどこで確認するか"
tags:
  - CloudflareWorkers
  - JavaScript
  - 非同期処理
  - テスト
private: false
updated_at: null
id: null
organization_url_name: null
slide: false
ignorePublish: true
---

waitUntilへPromiseを渡して202を返しても、後続処理の成功を返したことにはなりません。応答を読み終えた時点と、処理が完了・失敗した時点を別々に記録します。

ローカルのworkerdで、外部依存に相当する処理を途中で止め、応答の後から成功・失敗を返して比較しました。waitUntilの有無とともに、応答を読めた時点と後続処理の結果を確認しています。

## 応答を返すまで待つ処理と、返した後も続く処理

検証日は2026年9月11日です。macOS 26.6.2、Node.js 24.15.0、Wrangler 4.131.0、Miniflare 5.20260910.0-alpha、workerd 1.20260910.1を使いました。compatibility_dateは2026-09-11、nodejs_compatを有効にしています。Miniflareは、このWranglerの依存でもある版です。

題材のcircle-hubには、固定commit `a34608c`の[通知処理](https://github.com/takahiro-saeki/circle-hub/blob/a34608c611ded6549c1176a7977e68e1bc62a8db/apps/web/src/server/api/lib/notify.ts)に、Promiseをctx.waitUntilへ渡すrunAfterResponseがあります。この実装を本番で変更したり、実通知を送ったりはしていません。

比較用Workerでは、次の処理を用意しました。SINKは実サービスではなく、Node側の代替Service Bindingです。gateへの応答を保留し、テスト側が指定したタイミングで200または503を返します。EnvはWranglerで生成しています。

```ts
async function backgroundJob(env: Env, id: string) {
  const response = await env.SINK.fetch(`http://sink/gate/${id}`);
  if (!response.ok) throw new Error(`Background job failed: ${id}`);
  await response.text();
  await env.SINK.fetch(`http://sink/done/${id}`);
}
```

awaitでこの関数を待つ場合と、ctx.waitUntilへ渡してすぐ202を返す場合を比較しました。テスト側では、応答本文を読めるかを先に確認してから、保留した依存処理を解放します。

[比較用Workerとハーネス](https://github.com/takahiro-saeki/articles/tree/codex/article-stock-2026-09/experiments/article-stock-2026-09/workers-batch15)には依存を固定したlockfileがあります。依存を入れた後、リポジトリのルートから`node experiments/article-stock-2026-09/workers-batch15/run.mjs`で比較を実行できます。完了後もキャッシュ比較用のローカルサーバーが動くので、終了時はCtrl+Cで止めます。

| 条件 | 依存処理を止めている間 | 成功を返した後 |
| --- | --- | --- |
| await backgroundJob | 応答本文はまだ読めない | 処理完了を記録してから202を読めた |
| ctx.waitUntilへ渡す | 202と本文を先に読めた | その後に処理完了を記録できた |

waitUntilは、処理を「応答後に開始する」APIでもありません。backgroundJobを呼んだ時点で処理は始まります。今回のログでも、処理開始は応答の読み取りより前でした。

## 片方の失敗で、別のPromiseは止まるか

同じリクエストで、2つのPromiseを別々のctx.waitUntilへ渡しました。先に片方の依存先へ503を返し、後からもう片方へ200を返します。

最初の202はそのままで、成功側は完了を記録しました。失敗側は完了せず、観測時点で処理開始の記録は1回でした。これは[公式のContext仕様](https://developers.cloudflare.com/workers/runtime-apis/context/)が説明する、別々のwaitUntilへ渡したPromiseの独立性と対応しています。

ここではPromise.allで一つにまとめた場合との比較はしていません。また、1回しか観測されなかった結果だけから、別の基盤や呼び出し元にも再試行がないとは判断しません。確認したのは、このWorkerの処理とローカルの記録です。

## 202を返した処理の失敗を、別に残す

失敗を観測する比較では、呼び出し側を次のようにしました。これは実アプリへ適用済みの修正ではなく、比較用Workerの分岐です。

```ts
ctx.waitUntil(backgroundJob(env, id).catch(async error => {
  console.error(JSON.stringify({ event: 'background-failed', id, message: error.message }));
  await env.SINK.fetch(`http://sink/failed/${id}`);
}));
```

202を読んだ後に依存先へ503を返すと、失敗を示すログと、SINKの失敗記録が残りました。この条件でも処理開始は1回です。このcatchは失敗を記録し、再試行は行いません。

catchでログを出して正常に戻ると、外側のPromiseは解決します。「Promiseが解決した」と「元の仕事が成功した」も同じではありません。完了と失敗を違うイベント名で残し、対象の処理を識別できるようにします。

この例の失敗記録先も、別のI/Oです。記録自体の配送保証までは検証していません。実際の観測基盤へ組み込む際には、ログの収集経路と欠落時の扱いを確認します。

## ローカルで35秒続いたことを、本番の寿命にしない

もう一つの条件では、202を読み終えた後、代替依存先を35000ミリ秒保留しました。今回のローカルworkerdでは、解放後に完了記録が届きました。

一方、公式仕様ではHTTP起点のwaitUntilに、応答送信または切断後から最大30秒の制限があります。同じリクエスト内のwaitUntilで共有する枠で、リクエスト全体の経過時間の上限とは異なります。

したがって、この35秒の試験は本番の制限を再現した結果ではありません。ローカルで完了したことを根拠に、Cloudflare上でも同じ時間だけ継続すると見積もることはできません。今回、本番へのデプロイや切断試験は行っていません。

## 再試行が必要な仕事は、保存と配送を設計する

waitUntilが受け取るのは、実行中のPromiseです。仕事を永続化して後から取り出す仕組みや、失敗した処理の自動再配送まで、この呼び出しに含まれているとは扱いません。

[Cloudflare Queuesの再試行仕様](https://developers.cloudflare.com/queues/configuration/batching-retries/)には、再配送や最大再試行、dead-letter queueの扱いがあります。失敗後も処理を続けたい仕事では、こうした配送経路と、重複実行時の扱いを合わせて検討します。この記事ではQueueの導入・送信・consumer試験はしていません。

実験では、応答、開始、完了、失敗の4種類を記録しました。202という応答だけを成功数へ足さず、後続処理の結果と対応させるところから確認できます。
