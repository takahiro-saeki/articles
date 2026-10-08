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

- mainへ反映済み: `2ecfa9a86a214cbb086f2bbc6ec4d9a3ce04f35f`。予約workflowをactiveへ戻した。
- [本番dry-run 37709367533](https://github.com/takahiro-saeki/articles/actions/runs/37709367533): 成功、10/8の対象がQiitaのT09であることを確認。
- [公開実行37709473529](https://github.com/takahiro-saeki/articles/actions/runs/37709473529): 成功、公開メタデータのコミット `4dda99c98aa24b5e80e6daaa53f77fc8075183ef`。
- 10/8 09:46 JST: [Node.js日本語版](https://qiita.com/hiro123/items/77dffa5c9da6166e66a6)をQiitaへ公開。[英語版](https://dev.to/hirodeath/debugging-mixed-esm-and-commonjs-separate-module-classification-from-loading-3072)はID 4785124を維持してcanonicalを更新。
- workflow内で公開APIの本文・canonicalと公開ページを確認し、ログアウト状態のブラウザでも両方の本文と英語版のQiita出典リンクを確認。[確認記録](public-verification.json)。ローカルurllibでのAPI取得は403 Forbidden Botsのため、API照合はworkflow側の結果を根拠とする。
- 未公開4本のうち1本を回復。残る3本は10/9・10/10・10/11のQiita予約。変更後の未公開日本語は67本（Zenn9・Qiita58）。英語は26本公開済み、未公開64本。
- 将来のZenn9本は予約と模擬検証までで、実公開は10/17以降。

## 再実行の検証

[37709929642](https://github.com/takahiro-saeki/articles/actions/runs/37709929642)では同じQiita/dev.to IDで公開確認が成功し、新規投稿は発生しなかった。ただし先行するQiita同期のコミットに対して、待機中の予約ジョブが古いイベントSHAをcheckoutしており、確認時刻の保存pushがnon-fast-forwardで失敗した。両workflowを同じconcurrency groupにするだけでなく、実行開始時の最新ブランチを明示してcheckoutするよう修正した。

修正コミット `1827ba317b658fc8e23cce33506ab8cf6521b526` をmainへ反映後、[再実行37710179409](https://github.com/takahiro-saeki/articles/actions/runs/37710179409)が公開確認・進捗表再生成・メタデータpushまで成功。同じQiita ID 77dffa5c9da6166e66a6とdev.to ID 4785124を維持した。予約workflowはactiveを確認済み。

## Wiki

plane_personalのhiro-work（cf203a06-7d77-4b65-b020-4ef4f6e6857b）へ接続確認。7 Projectの一覧にarticlesの対応先はなく、汎用hiro work Projectにも対応ページを確認できなかった。新しいProjectや別Projectの機能ページは作成していない。仕様の正本は [spec.md](../../../../docs/features/scheduled-publishing/spec.md)、同期用の要約は同ディレクトリのplane-summary.htmlに保存する。
