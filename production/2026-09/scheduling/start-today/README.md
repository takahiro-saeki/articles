# 2026-09-12開始への前倒し

ユーザーの「今日から投稿して欲しい」という追加指示により、90組の順序と組み合わせを保って1日前倒しした。期間は2026-09-12〜2026-12-10。初日はP01を日英セットで手動公開し、翌日以降は09:00（Asia/Tokyo）を基準に予約処理で公開する。

[変更前の計画](previous-approved-plan.json)を保存し、[現行計画](../approved-plan.json)に変更指示を記録した。既存の38日分は変更していない。

## 公開前の検証

- 全90日の日付が連続し、重複がなく、順序・媒体・日英の組み合わせが変更前と一致。
- 全90組のfrontmatter、下書き設定、canonical方針、タグ、フェンス、対訳コード・出典を検証。
- 全180原稿のhashは直前のHumanizer監査に基づく記録と一致。
- 全90日のCLI dry-runと送信内容の模擬照合に成功。
- `npx zenn list:articles` と `git diff --check` に成功。

[日付変更後の投稿処理検証](publisher-verification.json)、[90組の検証](content-validation.json)を保存。模擬実行は実際の記事を公開しない。

初日の本公開は、更新したmainを対象に `Publish scheduled article` を `date=2026-09-12`、`dry_run=false` で実行する。完了後に実行IDと公開URLを追記する。今日の予約行も残すため、後の定期実行は保存済みの日英の公開状態を見てスキップする。
