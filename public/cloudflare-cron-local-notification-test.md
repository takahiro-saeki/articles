---
title: Cloudflare Cron Triggersをローカル実行して通知処理をテストする
tags:
  - Cloudflare
  - CloudflareWorkers
  - Wrangler
  - Nextjs
  - Push通知
private: false
updated_at: ''
id: null
organization_url_name: null
slide: false
ignorePublish: true
posting_campaign_uuid: null
agreed_posting_campaign_term: false
---

Cloudflare WorkersのCron Triggersで、練習当日の朝にPush通知を送っています。困ったのは、cron時刻まで待たずにローカルで一連の処理を確認する方法でした。

実装ではWorkerの`scheduled`イベントと、通知処理を担当するHTTP Routeを分けています。

## scheduled handlerを薄くする

Workerではcronを受け取り、内部のRoute Handlerを呼びます。

```ts
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return handler.fetch(request, env, ctx);
  },

  async scheduled(_controller: ScheduledController, env: Env) {
    const request = new Request(
      "https://internal/api/cron/morning-reminder",
      {
        method: "POST",
        headers: { authorization: `Bearer ${env.CRON_SECRET}` },
      },
    );

    await handler.fetch(request, env);
  },
};
```

日時判定、対象ユーザーの取得、Expo Push APIへの送信までを`scheduled`へ直接書かないのがポイントです。同じ処理をHTTP経由でも起動できるため、ローカル確認が楽になります。

## Wranglerをscheduled test付きで起動する

ローカルでは次のように起動します。

```bash
npx wrangler dev --test-scheduled
```

Wranglerが表示したURLへ、`/__scheduled`を付けてアクセスします。

```bash
curl "http://localhost:8787/__scheduled?cron=0+22+*+*+*"
```

`cron`には設定と同じ式を渡します。Cloudflare側ではUTCで扱うため、JSTの時刻だけを見て式を書かないようにします。

## HTTP Routeを直接呼ぶ方法も残す

通知対象の抽出だけを確認するときは、内部Routeを直接呼べます。

```bash
curl -X POST http://localhost:8787/api/cron/morning-reminder \
  -H "Authorization: Bearer $CRON_SECRET"
```

このRouteは`CRON_SECRET`を検証します。ローカルだから認証を外すのではなく、`.dev.vars`へ開発用の値を設定しました。本番用secretはソースへ入れません。

## 実送信と対象抽出を分けて確認する

ローカルDBに当日の日程、参加者、Push Tokenがなければ、cron自体が動いても送信件数は0です。確認時は次を順に見ます。

1. `scheduled`からRouteまで到達したか
2. タイムゾーン変換後の日付が合っているか
3. 対象の日程と参加者を取得できたか
4. Push Tokenがあるユーザーだけに絞られたか
5. 外部APIの結果を記録できたか

cronのテストで難しいのは起動方法より、テストデータと現在時刻の組み合わせです。処理本体をHTTP Routeへ分けると、scheduledイベントの配線と通知ロジックを別々に確認できます。

## 参考

- [Cloudflare Workers: Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)
- [Wrangler commands](https://developers.cloudflare.com/workers/wrangler/commands/)
