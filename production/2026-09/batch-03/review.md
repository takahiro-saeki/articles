# Batch 03: Planeの情報配置と制作記・成果物の検証

確認日: 2026-09-11。P14/P15/O09/O12/O17/O18の日英6組。全件Zenn向け。これで17/90完成、残り73件。先に書きたい12本は9件完成、T01/T31/T37は本文あり・Qiita canonical未確定のため未完成のまま。

## 記事ごとの答えと確認範囲

| ID | 読者に渡す答え | 実際に確認したこと | 制約・未実装 |
| --- | --- | --- | --- |
| P14 | 複数実装で使う共通ルールはPage、今回の完了条件はWork Itemに残す | 個人PlaneのSquadNote Project Pages 0件、SQN-29/30の説明、Gitの検証文書と追加履歴、Plane公式Pages | Pageは作成しておらず導入案。Web確認記録とモバイル未完了を区別。アプリを再テストしていない |
| P15 | 同じ欄の編集場所を先に決め、PR参照と状態変更も分ける | Plane公式の同期方向・参照形式と、GitHub公式のdefault branchでの終了キーワード条件 | 実環境の同期や競合、遅延は未検証。連携設定も変更していない |
| O09 | 制作記の数字には、テストが実際に数えた単位と対象外を添える | 実カタログの6ステージと2ボスから720順序/1440ケースを再計算。監査GDScriptのメソッド呼出しと残項目を読む | Godot監査・人手通しプレイ・公開ページ確認は再実行していない。チャット全件やPDFの照合はしていない |
| O12 | 提出説明を、ファイルの実体と端末確認の結果に合わせる | キット記載の6スクリーンショットと2coverをGitから読み、形式・寸法をヘッダー解析とfileで照合 | スクリーンショットは拡張子png/実体JPEG。アップロード失敗との因果は未確認。画像修正、実機プレイ、提出は未実施 |
| O17 | 生成、判断、利用を分け、候補IDから原本と利用先をたどる | 30batch/107候補、ID重複0、原本欠落0。人の承認35/保留13/却下3/未確認56。未確認3件のpreload。採用例の原本/cutoutのハッシュ差 | 107枚の目視評価や再生成は未実施。未記録の承認を「誰も見ていない」としない。候補ごとの派生利用先構造は提案 |
| O18 | workflow本体、モデル識別、環境、最後に確認できた処理段階を残す | 固定コードの既存34テスト、repo validator。実CLIにfake clientを入れ、待機なしでは記録あり、受付後timeoutでは記録なしをassert | GPU/ComfyUI実通信/モデル再取得/重みハッシュ/ピクセル一致は未検証。段階ごとの保存とモデル台帳の自動添付は未実装 |

## 一次資料とGit履歴

- circle-hub: `0cda1e865ad80d1529197729d8d436e96d56edc7`。`docs/testing/sqn-30-trial-participant-checklist.md`の追加履歴`12cbb78`を確認。Web済/モバイル人手確認の未完了、本番反映を含めない範囲を読み取った。公開用の記事・証跡に開発用招待URLやテストアカウントを転記していない。
- 個人Plane: [必要な項目だけの記録](plane-evidence.json)。SQN-29「体験参加者を段階的に正式メンバーへ移行できる仕組みを整備する」、SQN-30「[Step 1] 体験参加者権限と手動昇格・終了を実装する」を読み取り。Project一覧や途中のWork Item一覧取得を、全Work Itemの内容確認とは扱っていない。
- game-jam-lab: `f074703848586828b6a5acc0e465ccdd2c0d5244`。関連履歴は`821663a` story campaign、`3a40894` encounter/story/defeat polish、`bf5c7e7` key art/trailer、`f074703` release candidate。進行中のワークツリーに触れず、Gitの固定時点を読む。
- local-anime-studio: `2aeb306e4baa272afab9a133357eb1e6e141e964`。`d78eb55`画像生成基礎、`2aeb306`ローカルUIの追加。CLI、records、webui、workflow、モデル台帳、AGENTSと関連テストを読んだ。固定archiveの一時コピーで単体テストとCLI実験を実行。repo validatorは元のcleanリポジトリで読み取り実行し、成功。

## 公式資料

- [Plane Pages](https://docs.plane.so/core-concepts/pages/overview): requirements文書の用途。Work Item mention/selection conversionは確認時Business表示。権限については今回の文章で新たに断定しない。
- [Plane GitHub integration](https://docs.plane.so/integrations/github): Pro表示、GitHub→Plane一方向時の上書き、双方向、PRの角括弧あり/なし。ラベル表記にgithub/gitHubの揺れがあるため記事ではラベル設定手順を扱わない。本文は編集責任とPR参照に絞った。
- [GitHub PRとIssueのリンク](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/linking-a-pull-request-to-an-issue): closing keywordはdefault branchを対象とするPRで解釈され、そこへのマージでIssueを閉じる。
- [itch.io HTML5](https://itch.io/docs/creators/html5): ZIPのindex.html、参照パス、大小文字、埋め込み表示。
- [ComfyUI server routes](https://docs.comfy.org/development/comfyui-server/comms_routes): POST /promptは検査とキュー受付、/system_statsと/history/{prompt_id}の用途。
- [PyTorch reproducibility](https://docs.pytorch.org/docs/main/notes/randomness.html): seedだけではバージョン・環境をまたいだ完全一致を保証しない。実際のPyTorchを使う生成検証はしていない。

## 実験結果と再実行

- [game-submission-evidence.json](game-submission-evidence.json): Node v24.15.0。組み合わせ数、8画像の形式と寸法、素材台帳の件数・存在・状態、原本/cutoutのSHA-256とコード参照。
- [image-file-types.json](image-file-types.json): Gitから一時ファイルへ取り出し、macOSのfile -bでも6 JPEG/2 PNGを確認。元の画像は変更していない。最初のPNG固定assertが失敗したため実体の形式判定へ修正した。標準入力へのfile実行では早期終了によるEPIPEが起きたため一時ファイルで再確認した。
- [local-image-records.json](local-image-records.json): Python3.14.5。実CLIの待機なし/待機timeout。どちらもfake queueが受付し、後者では記録が存在しない。
- [local-anime-unit-tests.txt](local-anime-unit-tests.txt): 固定コピーで既存34件成功。実GPUは使っていない。
- [snippet-verification.json](snippet-verification.json): O09の掲載JSそのものを実行して720/1440。O17の掲載JSON全フィールドを元manifestへ照合。O18の簡略化Pythonは構文検証のみで、単体実行用でないことを日英へ明記。実際の保存挙動は別のCLI実験で確認。

再実行はarticlesリポジトリから以下を使用する。関連個人リポジトリは同階層にある前提。引数で場所を指定できる。いずれも外部生成APIや公開操作は行わない。

```bash
node experiments/article-stock-2026-09/game-submission-evidence.mjs
python3 experiments/article-stock-2026-09/local-image-records.py
node experiments/article-stock-2026-09/verify-batch03-snippets.mjs
```

## 既存記事との重複確認

日英のタイトル完全一致なし。基準コミットの記事と新規記事を4文字gramで比較し、類似度上位の本文と既存VOLT NOMAD記事を直接比較した。類似度は候補抽出のみで、合否閾値には使わない。

- P14はP01のプロダクト境界、P03のModule/Cycleと異なり、仕様の寿命と今回の受け入れ条件をどこへ書くかに限定。P02の管理権限を繰り返さない。
- P15はPlane内の整理単位と異なり、GitHubとの編集責任、同期上書き、PR状態連携を扱う。
- O09はO05の決定ログを再開材料として残す話から、公開原稿の主張単位の検証へ変更。既存codex-productionには1440経路の紹介があるが、今回は実呼出しの範囲・別計算の限界・未完了原稿の取り扱いを詳述。通常プレイ回数や人の体験に言い換えない。
- O12は既存codex-productionの提出資料の紹介とO10のexportパス検証から、提出文の対応条件と実ファイルの形式不一致へ切り口を変更。
- O17は既存codex-productionの素材をゲーム画面で選ぶ説明から、台帳の現状監査、未確認記録のpreload、原本と派生ファイルを追う方法へ変更。既存記事の92点を流用せず、今回のmanifest全候補107を実際に数えた。既存記事は編集していない。
- O18は候補素材の採否と異なり、ローカル生成CLIの実行条件とtimeout時の記録欠落を扱う。

## Humanizerと日英照合

Humanizer v2.9.1に沿って導入の過剰な対比、重複した締め、抽象的な利点の説明を編集。[編集計画](humanizer-edits.json)と[監査](humanizer-audit.json)に12ファイルの編集前後ハッシュと意味の確認を保存。frontmatter、全コードフェンス、URL、数値トークンが不変。原稿の最終SHA-256も一致。

全6組で、問題・調べ方・具体例・結果・制約を各節の英語版へ保持した。実装済みと提案、過去の文書記録と今回実行した検証、静的参照と実画面の区分を日英で照合。JS/Python/JSONフェンスと出典リンクは機械的に一致。textの構成例・図は意味を保って翻訳。

## 最終検証

- `npx zenn list:articles`成功。[出力](zenn-list.txt)に新規6件あり。
- `node scripts/validate-article-stock.mjs --batch=3`成功。[6組の結果](content-validation.json)。frontmatter、flags、4件以内のdev.to tags、canonical、fences、コード一致、JSON構文、日英タイトル重複、予約表除外。
- `node scripts/validate-article-stock.mjs`成功。[完成対象17組](complete-validation.json)にcanonical例外なし。
- [repository-guard.json](repository-guard.json): 基準8a1bfa8の記事/予約/公開workflow/scriptsなど130ファイルがbyte同一。バッチ2までの記事153ファイルも同一。Humanizer最終12ハッシュ一致。
- `git diff --check`とステージ後の`git diff --cached --check`を実施。
- 新規6組の日本語と英語はすべて`published: false`。Qiitaや既存の公開フラグ、予約表、公開workflowは変更なし。
