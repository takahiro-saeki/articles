---
title: 外部生成APIの429をリトライしつつ、一部失敗を許容するバッチ設計
tags:
  - TypeScript
  - Nextjs
  - API
  - Retry
  - エラーハンドリング
private: false
updated_at: ''
id: null
organization_url_name: null
slide: false
ignorePublish: true
posting_campaign_uuid: null
agreed_posting_campaign_term: false
---

画像生成APIへ複数案を順番に発注していたところ、同時ジョブ上限で429が返るようになりました。API Routeがそのまま500を返すと、クライアントは全件を再実行し、先に成功した案まで重複して生成されます。

対策は、429だけをサーバー内でリトライし、それでも失敗した案は飛ばして成功分を返すことでした。

## リトライ対象を絞る

すべてのエラーを再試行すると、入力不備や認証エラーまで待ち続けます。外部APIのメッセージから、429と同時実行数超過だけを対象にしました。

```ts
const RATE_LIMIT_RETRIES = 5;
const RATE_LIMIT_WAIT_MS = 20_000;

async function createWithRetry(payload: Record<string, unknown>) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await createCharacterV3(payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const rateLimited =
        message.includes("429") || message.includes("concurrent");

      if (!rateLimited || attempt >= RATE_LIMIT_RETRIES) throw error;
      await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_WAIT_MS));
    }
  }
}
```

現在は固定20秒です。`Retry-After`を取得できるAPIなら、レスポンス値を優先した方が無駄な待機を減らせます。

## 1件の失敗で全件を捨てない

生成結果とエラーを別々の配列へ保存します。

```ts
const created = [];
const errors = [];

for (let index = 1; index <= variations; index++) {
  try {
    const result = await createWithRetry(buildPayload(index));
    created.push({
      characterId: result.characterId,
      jobId: result.jobId,
      name: buildName(index),
    });
  } catch (error) {
    errors.push({
      name: buildName(index),
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
```

少なくとも1件成功していれば200で両方を返します。

```ts
if (created.length === 0) {
  return apiError(new Error(errors[0]?.error ?? "生成に失敗しました"));
}

return NextResponse.json({
  characterId: created[0].characterId,
  jobId: created[0].jobId,
  characters: created,
  errors,
  status: "processing",
});
```

先頭2フィールドを残しているのは、単発生成を前提にした既存クライアントとの互換性のためです。

## クライアントは失敗分だけ再発注できる

成功と失敗を区別して返せば、UIは「3案中2案を受け付け、1案は失敗」と表示できます。全体をエラーにしないので、成功した外部ジョブのIDも失いません。

外部APIを使うバッチでは、HTTPリクエストの成功と各項目の成功を分けて考える必要があります。途中まで作成されたリソースを取り消せないAPIなら、全件再実行より部分成功を返す方が重複を防ぎやすくなります。
