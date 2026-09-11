# 第12バッチ: 記事運用とゲーム制作記録を読み戻す

2026-09-11。O02、O04、O06、O08、O11、O14の日本語Qiita下書きと内容を保ったdev.to英訳を作成した。6組とも本文・日英・Humanizerを確認した。Qiitaの将来のIDは未確定なのでcanonicalはnull、制作状態は「執筆中」。外部の下書き作成、公開、予約追加はしていない。

このバッチ後は完成41/90、本文検証済み74/90、canonical待ち33、本文の検証が残る候補16。完成までの残り49件には、URL待ち33件を含む。

## 記事ごとの答えと確認範囲

| ID | 読者が持ち帰る答え | 確認した結果 | 確認していないこと |
| --- | --- | --- | --- |
| O02 | canonicalの確定元を媒体と入口ごとに区別する | 固定Gitの実スクリプトを6モック条件で実行。Qiita応答URLの伝達、失敗時の停止、単体入口の文字列nullを確認 | 実APIの受け入れ、ページ表示、SEO効果、投稿スクリプトの修正 |
| O04 | 日英の組を、媒体別の公開枠へ割り当てて日数を出す | 6fe4649の68/41/27/22と136原稿を再集計。仮の4条件は41/20/0/1日。既存予約38行、9月11日以降0行 | 新規予約、投稿成功、記事の鮮度やシリーズ順、執筆速度 |
| O06 | hookが拒否しない結果と、認証確認成功を区別する | インストール済みhookを無変更で6モック条件。読み取り専用チェックは一致だけexit 0、残りexit 1 | 実pushでの拒否試験、hook登録の確認、全表記の網羅、SSHの認証確認、hookの修正 |
| O08 | 進捗件数を基準commitと根拠から復元して再開する | 実台帳から件数を復元。新しい引き継ぎ形式の例に根拠6ファイル。正常・版違い・誤件数・欠落・内容変化の5条件 | Codex別セッションでの完走、再開時間の短縮、外部ジョブの生存確認 |
| O11 | archiveの保存実体と現行の起動対象を別々に見る | 5198488のR100移動14件を前後とf074703でbyte照合。現行main.gdと古いルートREADMEのずれを確認 | 旧試作の再起動、PCKや配布サイズ、各案の不採用理由の推測 |
| O14 | 校正表のイベント数だけで全文抽出を判定しない | Godot実データと33イベント・101会話行の全項目をイベントごとに照合。3必須値/重複変異、意味を変えない改行で100行になる抽出漏れを再現 | 全ゲームの起動、Web release export、全画面確認、翻訳の意味の自動判定、実ブラウザでのセーブ不変 |

## 一次資料

準備Aの6候補を、リポジトリとローカル実装から確認した。[repository-sources.json](repository-sources.json)にarticlesとgame-jam-labの固定Git資料21件のcommit、path、SHA、直近履歴を収録した。記事作成の前に関連実装と設計資料を読み、他リポジトリの作業ツリーは変更していない。

- articles: `6fe464919b7fba46d27395668d39d1e44b7f6964`。予約/単体投稿スクリプト、予約表、台帳、生成した進捗表、直前バッチのレビューと本文/完成ゲート・Humanizer監査。
- game-jam-lab: `f074703848586828b6a5acc0e465ccdd2c0d5244`。起動コードとproject.godot、README、会話カタログ、ゲーム本体、会話設計、生成ツール。旧試作の移動は`51984887e2b2be66c1330a3ade8d82a9392532b6`。
- ローカルhook: `~/.Codex/hooks/check-github-account.sh`。Git管理下の実装とは扱わず、調査日とSHAを[identity-experiment.json](identity-experiment.json)に記録した。本文ではhookの存在、プロセスとしての動作、ホストによる登録を区別する。

現行公式資料の本文を2026-09-11に確認した。

- [Qiita API v2](https://qiita.com/api/v2/docs): 作成要求と応答のid/url。
- [Forem API v1](https://developers.forem.com/api/v1): canonical_urlとpublished、外部下書き。
- [GitHub CLI environment](https://cli.github.com/manual/gh_help_environment)・[gh api](https://cli.github.com/manual/gh_api): 資格情報の優先順位、userの応答選択。追加でローカル`gh auth git-credential --help`も確認した。
- [OpenAI AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md): 作業規約の読み込み。従来のdevelopers.openai.comから当該公式ページへリダイレクトする。任意JSONによる自動再開機能を説明しているわけではない。
- [Godot filesystem](https://docs.godotengine.org/en/stable/tutorials/scripting/filesystem.html): project.godotとres://のルート。
- [Git diff](https://git-scm.com/docs/git-diff): -Mのrename検出とsimilarity。記事の一致主張は実byte比較でも確認した。

## 実行記録と限界

環境はmacOS、Node.js 24.15.0、Python 3.14.5、Godot 4.6.2.stable.official.71f334935。試験は一時ディレクトリまたはメモリ内で実行した。認証情報の読み出しや実APIの投稿は行わない。

- [canonical-experiment.json](canonical-experiment.json): 元コードをVMで読み、fs/fetchを差し替えた6ケース。単体スクリプトのcanonicalは文字列nullであり、APIが受け入れたという意味ではない。成功応答のURL/IDは合成値。
- [stock-analysis.json](stock-analysis.json): 旧commitの68/41/27/22件と4配分条件。この記事自身を含む後続制作によって当時の数字は変えない。
- [identity-experiment.json](identity-experiment.json): hookは入力のコマンドを実行しない。偽gh/gitでlogin、失敗、remoteだけを変えた。[read-only-identity-check.sh](read-only-identity-check.sh)は記事用の提案で、インストール済みhookへ適用していない。
- [handoff-example.json](handoff-example.json)・[handoff-verification.json](handoff-verification.json): 検証用に新規作成した形式。SHA一致の限界と、実プロセスの状態を保存文字列から推定しないことを明記。
- [archive-analysis.json](archive-analysis.json): 14件の移動元/先とhash。3 GDScript、3 UID、4画像、4 import。現行projectの外にあることは確認したが、ファイル移動だけで自己完結した実行環境にはならない。
- [story-verification.json](story-verification.json): 原カタログをGodotで評価し、別のNode生成表と比較。全33イベントのID、題、状況、101行のrole/話者/台詞を対応イベント内で照合。短い通信の12戦33行は表の件数のみ。改行変異後もGodotの全データは一致し、イベント見出し33のまま台詞が100行へ減る。
- [snippet-verification.json](snippet-verification.json): 掲載6実行可能ブロックと3補助ブロックの日英一致・実験との対応。掲載したPython関数は4ケースをそのまま実行して検証する。

再実行する場合:

```sh
node experiments/article-stock-2026-09/canonical-lifecycle-batch12.mjs
python3 experiments/article-stock-2026-09/audit-production-batch12.py
python3 experiments/article-stock-2026-09/identity-guard-batch12.py
python3 experiments/article-stock-2026-09/game-records-batch12.py
python3 experiments/article-stock-2026-09/verify-batch12-article-evidence.py
node scripts/validate-article-stock.mjs --batch=12 --allow-pending-canonical
npx zenn list:articles
git diff --check
```

外部リポジトリの固定Git、インストール済みhook、Godot実行ファイルが必要な試験を含む。環境がない場合は成功結果を流用せず、未実行として扱う。

## 重複・対訳・Humanizer

既存の38日投稿監査、予約投稿の復旧境界、リポジトリの決定ログ、Game Jamの再利用記事と比較した。O02はURLの確定経路と単体パーサー、O04は今後の配分容量、O08は再開時の証拠照合に絞り、過去の公開実績や判断履歴を再説明する記事にはしない。O11は旧案を保存した実体、O14は正規表現の抽出漏れが中心で、共通ツールや素材の来歴とは異なる。

O04/O08は同じ68/41/27/22件を使うが、前者は配分できる日数、後者は再開時に誤った完了状態を引き継がないための確認である。類似度検査と近接候補の本文を合わせて確認した。英訳は全節、表、具体例、失敗、制約を保持し、要約にはしていない。確認できない過去の体験や採用理由を追加していない。

Humanizer v2.9.1のdraft→audit→finalを12原稿に適用し、24箇所を手動推敲した。長い対比、重い言い回し、繰り返す前置きを整えた。[humanizer-edits.json](humanizer-edits.json)に変更と意味の照合、[humanizer-audit.json](humanizer-audit.json)にfrontmatter・コード・数値・URLの不変と最終SHAを保存した。

## 完成ゲートと保護

- [content-validation.json](content-validation.json): 6組の本文ゲート。未確定canonicalだけを明示的に除外。
- [canonical-gate.json](canonical-gate.json): 例外なしの完成ゲートは未確定canonicalで失敗する。
- [complete-validation.json](complete-validation.json): 完成41組を例外なしで検証。
- [zenn-list.txt](zenn-list.txt): Zenn一覧コマンドの結果。
- [repository-guard.json](repository-guard.json): 制作開始前137ファイルと今回直前259記事ファイルがbyte一致。候補表は進捗ブロック以外を保持。公開済み記事、予約表、workflowは変更していない。

公開抑止はQiita ignorePublish=true/id=null、dev.to published=false。6組をcanonical未確定のまま完成数に加えず、本文の検証済み件数に反映する。
