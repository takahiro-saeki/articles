# 日本語・英語記事の予約公開

- 機能ID: scheduled-publishing
- 対象: 個人リポジトリ takahiro-saeki/articles
- 最終確認日: 2026-10-08
- 比較基準: main c393e18960b3712b655e01a646aea44aafeb2efb
- 変更ブランチ: codex/weekly-zenn-qiita
- Plane: hiro-work接続を確認したが、articlesに対応するProjectが存在せず未同期。新しいProjectは作成していない。

## 現在の設定

10/17から毎週土曜1本をZenn、それ以外の日をQiitaにする。日本語1本/日、09:00 JSTが目標。10/8の変更時点の残り68本をZenn9本・Qiita59本として12/14まで配置した。Zenn未公開4本を10/8〜10/11にQiitaで回復し、既存のdev.to IDを使ってcanonicalを更新する。

予約表は `schedule/publishing-schedule.json`、頻度・アカウントは `schedule/publishing-policy.json`。本文と翻訳の180ファイルは移行前と同一で、13本の日本語frontmatterと配置をQiita形式へ変えた。以前公開された日本語記事は移動しない。

## 実行と完了判定

1. default branchのGitHub Actionsが当日の1組を選択する。手動日付指定は将来の公開を拒否し、dry-runではAPI呼出し・ファイル書換えをしない。
2. Zennは土曜・初回10/17以降・同日未公開・前回実公開から24時間以上を確認してpublished:trueを準備し、先にGitへpushする。週1本は予約日の7日間隔と土曜限定で守る。24時間は追加の制限であり、Zennが公表する具体的な上限件数を意味しない。
3. Zennの認証なし公開ページのstatus、title、path、publishedAtを確認する。403や下書きプレビューは成功としない。Qiitaは日本語を作成し、IDを保存してから公開APIの本文・タイトル・private:falseと公開ページを照合する。
4. 日本語を確認した後、英語を公開する。既存IDがあればGETで本文・タイトル・canonicalを照合し、違う場合はPUTで同じIDを更新する。新しい英語版だけPOSTする。
5. 英語の公開APIと実ページを確認し、`schedule/publication-state.json`へverifiedを記録する。frontmatterだけで成功扱いにしない。確認状態から制作進捗表と候補一覧の公開確認欄も再生成する。
6. 部分失敗時も受信済みIDと状態をGitへ保存する。日英のAPI成功が、Git保存まで原子的に保証されるわけではない。

## 失敗と再試行

通常のQiita同期workflowと予約投稿workflowは同じconcurrency groupで直列化し、同時のメタデータ保存を避ける。checkoutは起動イベントのSHAではなく実行開始時の最新ブランチを取得し、待機中に先行workflowが保存したメタデータを含める。

同じworkflow内で最大3回、30秒・60秒待って再試行する。失敗はActions上のfailureとなる。Zennの公開要求中に403/404が継続する場合はpublished:falseへ戻し、平日の他記事のpushで再び公開要求されることを防ぐ。解除前にもう一度実ページを読み、公開済みになっていれば非公開へ戻さない。通信障害や503など公開状態を確定できないときはフラグを変えず、未確認として失敗を残す。

失敗・未確認のZennが残る間は別の記事を開始しない。同じ日付の公開要求は次の土曜に手動再試行できる。公開済みの本文確認と英語の回復は曜日に依存しない。失敗により土曜の枠がずれた場合、後続の予約は再調整が必要で、自動で別記事へ飛ばさない。

API成功後に応答自体を失った場合はIDが保存できないため、再試行前に公開先を調べる必要がある。Git push失敗時にもrun logと保存済みメタデータを確認する。ZennのHTML構造変更やGitHubの予約遅延は失敗要因として残る。週1本でもZenn側の公開を保証するものではない。

## 検証と配信

- 実装: main反映済み（2ecfa9a）。公開メタデータは4dda99c。
- 検証: publisherの12ケース、90組dry-run、180本文・タイトル不変、frontmatter・canonical・タグ数・コードフェンス・重複・予約日を照合。
- 配信: 予約workflowはactive。10/8のQiita公開と既存英語版canonical更新をworkflowの公開API照合とログアウト状態のブラウザで確認済み。将来のZenn公開は未実行。
- Webアプリ画面・iOS・Android・Cloudflare構成: 対象外。
- 検証結果・実公開URL: [移行記録](../../../production/2026-09/scheduling/weekly-zenn/README.md)。
