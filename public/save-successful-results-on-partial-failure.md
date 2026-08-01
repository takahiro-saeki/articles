---
title: APIの部分失敗を許容し、成功した素材だけ保存する設計
tags:
  - TypeScript
  - API
  - Batch
  - エラーハンドリング
  - Nextjs
private: false
updated_at: ''
id: null
organization_url_name: null
slide: false
ignorePublish: true
posting_campaign_uuid: null
agreed_posting_campaign_term: false
---

複数素材を生成、保存、採用状態へ更新する処理では、1件の失敗で成功分まで失敗扱いにすると再実行が難しくなります。外部API側にはすでに画像があるのに、ローカル履歴にはないというずれも起きます。

Pixel Studioでは、項目ごとに結果を確定し、レスポンスへ成功数と失敗内容の両方を含めています。

## 全体をtry/catchで囲まない

バッチ全体ではなく、各項目を個別に処理します。

```ts
const successes = [];
const failures = [];

for (const input of inputs) {
  try {
    const result = await generate(input);
    await saveHistory(result);
    successes.push(result);
  } catch (error) {
    failures.push({
      sourceKey: input.sourceKey,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
```

生成に成功したら、その場で履歴へ保存します。ループ終了後にまとめて保存すると、後半の例外で前半の結果を記録できないためです。

## 安定した識別子を返す

失敗結果には配列番号ではなく`sourceKey`を入れます。

```json
{
  "succeeded": 3,
  "failures": [
    {
      "sourceKey": "history:image-42",
      "error": "rate limited"
    }
  ]
}
```

並び替えや再取得があっても、UIは失敗した素材を特定できます。再試行も`sourceKey`単位で行えます。

## 保存済みと採用済みを分ける

画像ファイルが保存されたことと、ゲームへ採用すると決めたことは別です。素材には`review`、`adopted`、`rejected`などの状態と`assetPath`を持たせています。

生成結果を保存できた時点ではレビュー対象です。人が確認して採用した後に、ゲーム側のmanifestと照合します。この区別がないと、ダウンロード成功をそのまま採用として扱ってしまいます。

## 全件失敗だけをリクエスト失敗にする

一件でも成功した場合は結果を返し、全件失敗した場合だけエラーレスポンスにします。クライアントは成功分を一覧へ追加し、失敗分を通知できます。

部分成功を採用するには、処理を冪等に近づける必要があります。同じ`sourceKey`の再保存をどう扱うか、外部ジョブIDを再利用するか、重複ファイル名を許すかを先に決めます。

バッチ処理の完了をtrueかfalseだけで返すと、再実行の単位が全件になります。成功した項目をその場で確定し、失敗した項目を識別できる形で返すと、外部APIを含む処理でもやり直す範囲を小さくできます。
