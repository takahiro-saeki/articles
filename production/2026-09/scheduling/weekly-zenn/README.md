# 2026-10-08: Zennを週1本へ変更

ユーザー指示: Zennの投稿頻度を週1回とし、その他をQiitaへ回す。曜日は土曜を指定。

Zennのデプロイ履歴に投稿数上限による除外があり、10/2・10/4・10/6・10/7予定の4本が匿名閲覧403・管理画面上は下書きだった。10/6に実公開された記事があるため、次のZennは10/17とした。

- 今後68本: Zenn9、Qiita59。ZennからQiitaへ13本を移動。
- 未公開4本: 10/8 Node.js、10/9 Durable Objects、10/10 Idempotency、10/11 Outbox。
- 1日1本の日本語公開を維持し、最終日は12/14。英語4本は既存IDでcanonicalを更新する。
- 原稿本文、数値、コード、出典、日英タイトルは180本とも移行前のmainと同一。Humanizer後の内容を保持した。
- Zenn週1本の方針は予約表と土曜限定の公開要求で守る。日本語の実公開確認後に英語へ進むよう投稿処理を修正。

## 根拠・検証

- [旧計画](previous-approved-plan.json)
- [13本の移行記録](migration.json)
- [90組の静的検証・dry-run](verification.json)
- `node --test scripts/publish-scheduled.test.mjs`: 12ケース成功（ネットワークは模擬）。
- [Zenn公式: 投稿上限](https://zenn.dev/faq/rate-limit)
- [Qiita公式API](https://qiita.com/api/v2/docs)

## 配信

main反映・予約再開・今日の実公開は作業中。確認後にここへ実行IDと公開URLを記録する。

## Wiki

plane_personalのhiro-work（cf203a06-7d77-4b65-b020-4ef4f6e6857b）へ接続確認。7 Projectの一覧にarticlesの対応先はなく、汎用hiro work Projectにも対応ページを確認できなかった。新しいProjectや別Projectの機能ページは作成していない。仕様の正本は [spec.md](../../../../../docs/features/scheduled-publishing/spec.md)、同期用の要約は同ディレクトリのplane-summary.htmlに保存する。
