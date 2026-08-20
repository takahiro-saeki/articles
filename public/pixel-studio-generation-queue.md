---
title: キャラクター生成をキュー化して一括処理できるツールを作った
tags:
  - Nextjs
  - TypeScript
  - Queue
  - API
  - 個人開発
private: false
updated_at: '2026-08-20T09:28:44+09:00'
id: 2a648245aa396a45296e
organization_url_name: null
slide: false
ignorePublish: false
posting_campaign_uuid: null
agreed_posting_campaign_term: false
---

ゲーム用キャラクターを外部APIで生成するPixel Studioに、一括生成キューを追加しました。以前は発注書を一件ずつ開いて生成していたため、案が増えるほど待ち時間と操作回数が増えていました。

キューは`queued`、`submitted`、`completed`、`failed`などの状態を持ち、キャラクター、アニメーション、発注書からの生成を同じ一覧で扱います。

## 追加時に入力を確定する

APIは複数entryを受け取り、種別ごとにpayloadを検証します。

```ts
type NewQueueEntry =
  | { type: "idea"; label: string; payload: { ideaId: string } }
  | { type: "character"; label: string; payload: CharacterPayload }
  | { type: "animation"; label: string; payload: AnimationPayload };
```

発注書は`queued`か`submitted`の同一IDがないか調べ、二重投入を防ぎます。アニメーションでは方向、フレーム数、キャラクターIDを投入前に検証します。

## pumpが空き枠へ投入する

キュー処理は`pumpQueue`へ集約しました。外部ジョブの状態を照合し、完了分を更新してから、空いた同時実行枠へ待機中のentryを送ります。

```ts
await pumpQueue({ force: true });
return NextResponse.json({ entries: await listQueue() });
```

専用Workerを常駐させず、ジョブ画面のポーリングや発注書画面の閲覧を駆動機会にしています。POST後はNext.jsの`after`からpumpを呼び、レスポンスを先に返します。

```ts
const added = await addQueueEntries(validated);
after(() => pumpQueue({ force: true }));
return NextResponse.json({ entries: added });
```

## 失敗とキャンセルを状態で制限する

待機中だけキャンセルでき、失敗したentryだけ再試行できます。

```ts
const result = await retryQueueEntry(id);
if (result === "not-retryable") {
  return apiError(new Error("失敗したエントリのみ再試行できます"), 400);
}
```

外部APIへ送信済みのジョブをローカルだけ削除すると追跡できなくなるため、どの状態から何へ移れるかをAPI側で決めています。

## UIは選択と進行状況を分ける

発注書一覧では未生成の案を複数選び、アニメーションも続けて作るか指定してキューへ追加します。ジョブ画面は10秒ごとに取得し、待機、送信済み、完了、失敗を表示します。

一括実行ボタンを付けるだけでは、途中失敗や再読込後の復元ができません。キューを永続化し、外部ジョブIDと状態を保存したことで、ブラウザを閉じても進行を追えるようになりました。
