# Batch 01: P01 / O01 / T28 / O05 / P03 / O03

調査・検証日: 2026-09-11。日英6組。完成は公開可能なストック原稿としての状態を指し、掲載・予約はしない。

## 根拠と対象範囲

| ID | 読者が持ち帰る答え | 一次資料と確認方法 | 確認しなかったこと |
| --- | --- | --- | --- |
| P01 | 作業コピーではなく継続して保守するプロダクトへ所属させる | 個人Planeの全5 Projectをread-only取得。circle-hubの通知仕様、dungeon-rogueliteのREADMEとチケット文書、Git履歴を照合 | 全個人開発のPlane移行、生産性の改善量 |
| P03 | 成果物・期間・横断目的のどれを判断するかで整理単位を選ぶ | Plane公式Projects/Cycles/Modules/Initiatives、個人Workspaceの無効状態、SQNの非アーカイブModule/Cycle各0件 | Module/Cycle/Initiativeを使った運用効果。配置例は今後の設計案 |
| T28 | 複数端末では登録と解除の対象範囲も変える | circle-hub ad0a669efb92e595aaf8d09d597d42b7b9d569f2、0cda1e865ad80d1529197729d8d436e96d56edc7のschema、router、sender、DevicePushSession、仕様と既存テストを確認 | 本番D1性能、配信済み状態、実端末受信、receipt取得。実機チェック欄は未完了 |
| O01 | 予定、日本語、英語、canonicalを一組で照合する | articles 8a1bfa8、予約38件と76原稿、Git履歴、GitHub workflow runsをread-only取得 | 09:00公開達成、読者反応の増加、全ページの現時点の表示 |
| O03 | 保存済みIDによる更新と、受付後の応答消失を分ける | articles 8a1bfa8の実投稿スクリプトをVMで6ケース実行。ファイル/APIはモック | 実サービスでの重複事故、障害発生率、Zenn反映、実workflowの待機 |
| O05 | 決定、実装、検証条件を同じGit時点で読み分ける | game-jam-lab f074703848586828b6a5acc0e465ccdd2c0d5244の制作計画、polish plan、RC監査とGit履歴 | ゲーム自動プレイの再実行。時間は既存監査からの引用。新形式の決定ログは提案 |

ローカル一次資料の作業ディレクトリ:

- `/Users/takahiro_saeki/Documents/GitHub/circle-hub-multi-device-push`
- `/Users/takahiro_saeki/Documents/GitHub/game-jam-lab`
- `/Users/takahiro_saeki/Documents/GitHub/dungeon-roguelite`

SLABYRINTHのREADMEは作業中の変更を含み、`docs/release-plane-tickets.md`は確認時点で未追跡だった。他タスクの作業内容は変更していない。P01ではローカル資料を調べた範囲として扱い、未コミットの資料に存在しないGitHub permalinkは作っていない。該当文書は2026-09-11更新で、製品仕様はdocsを正本、DRGのチケットで実行作業を管理する旨を確認した。

## 公式資料

- https://docs.plane.so/core-concepts/projects/overview
- https://docs.plane.so/core-concepts/cycles
- https://docs.plane.so/core-concepts/modules
- https://docs.plane.so/core-concepts/projects/initiatives
- https://docs.expo.dev/push-notifications/faq/
- https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule

すべて2026-09-11閲覧。Planeの古い候補パス（cycles/overview、modules/overview）は取得できず、公式ナビゲーションから正しいパスを確認した。

## 実行結果

- `npx zenn list:articles`: 成功。6本すべて列挙。`zenn-list.txt`に記録。
- `node scripts/validate-article-stock.mjs --batch=1`: 6組成功。必須frontmatter、未公開フラグ、dev.toタグ4件以内・有効文字、canonical、フェンス、日英実行コード一致、出典リンク一致、タイトル重複、予約表への不追加を確認。
- `node experiments/article-stock-2026-09/audit-publishing.mjs 8a1bfa8`: 38日/38予約、Zenn 19、Qiita 19、日英各38件の公開済み記録、canonical一致38。`publishing-audit.json`に保存。
- `node experiments/article-stock-2026-09/publishing-recovery.mjs`: モックのみ6ケース成功。ID保存後は更新、受付後にIDを失うと新規POSTへ戻る挙動を確認。`publishing-recovery.json`に保存。
- `node experiments/article-stock-2026-09/verify-push-snippets.mjs`: 記事の3 SQLブロックと1 TypeScriptメソッドを抽出・実行。再登録、複数行、移管後の古い解除、端末記録先行と失敗時保持を確認。`push-snippets.json`に環境・結果を保存。Nodeの型除去APIは実験的機能の警告を出すが実行は成功。
- circle-hub: `pnpm --filter @squadnote/web exec vitest run src/security/push-token-privacy.test.ts`: Vitest 4.1.4、8/8成功。
- circle-hub: `pnpm --filter @squadnote/mobile exec vitest run src/lib/device-push-session.test.ts`: Vitest 4.1.4、9/9成功。
- O05内の3つの`git show`参照: 対象コミットからすべて読めることを確認。
- `git diff --check`: 成功。最終staging後にcached側も確認する。

既存の英語原稿には引用符のないコロンを含むtitleがあり、全過去記事を一般のYAMLとして読む初回の監査は失敗した。既存投稿スクリプトと同じ行単位のメタデータ読取りへ合わせて再実行した。新規12原稿はYAMLとして検証し、既存原稿には変更を加えていない。

## 重複確認

文字列類似度は候補を絞るための補助値であり、内容の独自性の判定には使わない。`validation.json`に4文字の集合のJaccard類似度を記録した。既存記事のタイトルを全件照合し、近い記事と元の企画を読み比べた。

- P01とP03: 前者は実際の所属先とリポジトリ名の対応、後者は未導入機能も含む整理単位の設計。互いの用語説明や事例を全文転載しない。
- T28: 既存の認証構成・通知タップ・出欠通知記事と異なり、トークン一意制約、所属移管、登録/ログアウト競合を扱う。今後のO20は旧版混在と段階配信に絞る。
- O01とO03: 前者は38件の記録監査と指標の意味、後者は実スクリプトへの障害注入とID保存境界。記事数と障害復旧の説明を混ぜない。
- O05: `volt-nomad-codex-production.md`の制作工程全体を繰り返さず、日付の違う文書の照合と、目標/計測値の読み分けに絞る。

## Humanizerと翻訳

Humanizerスキルをfile/embeddedの手順で適用。初稿を読み、定型的な紹介、言い切りの連続、重複するつなぎ、英語の装飾引用符を修正した。

- `humanizer-audit.json`: 全12ファイルの前後hashを記録。frontmatter、コードフェンス、URL、数値トークン列が前後で一致。
- 数値以外は段落単位で確認。実装済みと設計案、再実行した検証と既存記録からの引用、未確認の実機状態を維持。
- 日英とも同数の節を持ち、表の全行、制約、再現コマンド、結果、出典を保持。英訳は要約にしていない。説明用図とMarkdownテンプレートは自然な英語へ翻訳し、実行可能コードは一致を機械確認。
- P01の表の5 Project、P03の0件/無効、T28の8+9テスト、O01の38/19/19/76、O03の6ケースと2件になる失敗、O05の15.58/23.26分を原資料と照合。
- ユーザーが体験したと確認できない一人称エピソードは追加していない。

## 次のバッチへの引継ぎ

優先12本の残りはT31、T37、T20、T01、O07、O10。T31はandroid-safe-area-hotfixの履歴とAndroid公式、T37はローカルD1/SQLiteの計画比較、T01は仕様と部分失敗の実行結果を確認する。

Qiita新規IDが未確定のため、英語canonicalをどう仮置きするかをユーザーへ確認中。回答が来るまでQiita原稿のURLを推測して完成扱いにしない。Zenn記事のcanonicalは既存アカウント`hirodeath`とslugの公開予定URLで確定できる。
