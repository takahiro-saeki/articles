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

## 初日の公開結果

2026-09-12 08:18（JST）にP01の英語版を公開。日本語版もZennへ反映され、両ページのHTTP 200と記事タイトルを確認した。

- [日本語版](https://zenn.dev/hirodeath/articles/plane-project-boundaries)
- [dev.to英語版](https://dev.to/hirodeath/organizing-personal-plane-projects-around-products-rather-than-working-directories-4en3)
- [GitHub Actions実行](https://github.com/takahiro-saeki/articles/actions/runs/34657544385): 成功

公開メタデータのcommitは `bb5133ed52a8383383842d3fa60a2bed36c66f6f`。変更はP01の日英2原稿の公開フラグ・dev.to IDだけで、本文は一致。英語版の公開APIから本文の一致とcanonicalが日本語版URLであることも確認した。

[実行結果](first-publication.json)と[公開ページ確認](public-page-verification.json)に根拠を保存。今日の予約行は保持しており、公開後のCLI dry-runでは日英とも公開済みと判定された。今日の定期実行は保存済み状態を見てスキップする。翌日のO01から残り89組を、毎日09:00（Asia/Tokyo）基準で公開する。
