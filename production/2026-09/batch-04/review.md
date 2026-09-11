# Batch 04: Nodeの読み込み境界とCloudflareの保存・再実行

確認日: 2026-09-11。T09/T39/T40/T42/T44/T45の日英6組、すべてZenn向け。完成時点で23/90件、残り67件。先に書きたい12本のうち9件が完成、T01/T31/T37は本文あり・Qiita canonical未確定のまま。未解決のURLは作らず、完成件数へ入れない。

## 記事ごとの答えと検証

| ID | 読者に渡す答え | 実際に確認したこと | 制約・未実装 |
| --- | --- | --- | --- |
| T09 | ファイルのESM/CJS判定と、相手を読む方法を分けて確認する | Node v24.15.0の独立プロセス10ケース。type、拡張子、内側package、同期ESM require、TLA、dynamic import、相対拡張子、構文検出 | 現行資料v26.8.2は実行版と区別。bundler、TS変換、custom loader、構文検出の性能は未検証 |
| T39 | 次ページ方式の移行では、返る配列と読み取る範囲を同時に比べる | ローカルD1の10万行、5位置で同じ20件をassert。rows_read、同じcovering index、各4 warmup+11計測、途中挿入によるOFFSETの重複 | 本番遅延・請求・普遍的な切替件数は示さない。カーソル準備は計測外。変更は先頭1件挿入のみ |
| T40 | Object別保存へ移す前に、横断クエリと集約経路を棚卸しする | D1一つとSQLite-backed DO二つへ合成データを保存。同名再取得、新ID空、個別取得、明示した対象からの集約を8 assertionsで確認。生成EnvとcheckJs | リモート移行・性能・WebSocket・障害復旧・同時更新時の全体snapshotは未検証。D1 projectionは提案 |
| T42 | 再開単位を時刻起動、メッセージ、処理ステップに分けて選ぶ | Cron/Queues/Workflowsの現行公式資料。UTC、at-least-once、個別ack/retryと自動ack、step再試行、イベント待ちを照合 | 構成は導入案。トリガー、consumer、DLQ、Workflowは作成・実行していない。導入試験も提案 |
| T44 | 再送を同じ結果へ戻すには、キーの範囲・入力比較・原子的な結果保存が必要 | ローカルD1で6ケース。応答消失、入力相違、別actor、2同時miss、note制約失敗による全rollback、結果削除後の再作成 | 信頼済みactor引数、成功結果のみ保存。HTTP/auth/TTL自動削除は未実装。外部送信は対象外 |
| T45 | Outboxの意図保存と、送信先での重複排除を分けて検証する | ローカルD1とfake providerで4ケース。outbox制約失敗、commit後の配送、送信後中断の重複排除なし/あり | 例外による中断、プロセスkillや永続化再起動はなし。単一consumer。lease、retry運用、DLQ未実装 |

## 公式資料と確認した範囲

- [Node Packages](https://nodejs.org/api/packages.html): `.mjs`/`.cjs`/`.js`、最寄りpackageのtype、構文検出。
- [Node v24.15.0 Modules](https://nodejs.org/download/release/v24.15.0/docs/api/modules.html): 同期ESMのrequire、依存グラフのtop-level await制約。現行Modulesページも比較。
- [Node ESM](https://nodejs.org/api/esm.html): 相対・絶対importの拡張子。最新版表示v26.8.2と実験v24.15.0を混同しない。
- [SQLite Row Values](https://www.sqlite.org/rowvalue.html): 複数列比較とOFFSETの読み飛ばし。
- [D1 use indexes](https://developers.cloudflare.com/d1/best-practices/use-indexes/): EXPLAIN QUERY PLAN、covering index、返る件数とrows_read。
- [D1 batch](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch): バッチ内のDBトランザクションと失敗時のrollback。
- [DO storage](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/): Object専用storage、同期SQLとcursorの消費、別Objectのデータへ自動横断しない境界。
- [DO state](https://developers.cloudflare.com/durable-objects/api/state/): 初期化時のblockConcurrencyWhileとイベント配送。外部通信を長く囲む例は書いていない。
- [DO namespace](https://developers.cloudflare.com/durable-objects/api/namespace/): getByNameとnewUniqueIdの違い。
- [DO concepts](https://developers.cloudflare.com/durable-objects/concepts/what-are-durable-objects/): 実行主体とObject固有の保存。
- [Workers best practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/): binding型生成、互換日、Promise処理。DO実験は生成Envと現行型で確認した。
- [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/): scheduled handlerとUTC。
- [Queues delivery](https://developers.cloudflare.com/queues/reference/delivery-guarantees/)、[batching/retries](https://developers.cloudflare.com/queues/configuration/batching-retries/): at-least-once、個別ack/retry、正常return時の自動ack。ローカルskill参照ファイルに古い説明があるため現行公式を採った。
- [Workflow sleep/retry](https://developers.cloudflare.com/workflows/build/sleeping-and-retrying/)、[events](https://developers.cloudflare.com/workflows/build/events-and-parameters/)、[rules](https://developers.cloudflare.com/workflows/build/rules-of-workflows/): step、待機、再実行と外部処理の冪等性。
- [Stripe idempotency](https://docs.stripe.com/api/idempotent_requests): status/body、入力一致、保持後の新規処理。実験は成功結果のみ保存し、Stripeの失敗結果保存などの契約全部を再現しない。資料のサンプルキーは転記・使用していない。
- [AWS transactional outbox](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html): 同じDB内の業務データと通知意図、その後の配送と重複への対処。AWSへ接続していない。

## 実験の証跡と再現

- [node-module-boundaries.json](node-module-boundaries.json): 一時fixtureの内容、各プロセスの終了・出力と10ケース。NODE_OPTIONSを子プロセスから外し、最後に一時ファイル削除。
- [d1-pagination.json](d1-pagination.json): 合成100000行、全5位置のID・カーソル値・生の11回の時間・meta・検索計画、途中挿入の結果。表の時間はこの観測値を3桁へ丸めたもの。追加実験で測り直して置き換えてはいない。
- [d1-idempotency-outbox.json](d1-idempotency-outbox.json): 冪等性6ケース、Outbox4ケース。競合は両方のcache missの後にbarrierを解放。偽送信先の回数であり、実際の通知回数ではない。
- [do-partitions.json](do-partitions.json): 同じredがalice、blueがbob、新IDが空、両方集約がD1一致、一部対象で一部だけになることを確認。HTTP成功を含め8 assertions。
- [do-types-validation.json](do-types-validation.json): Wrangler 4.131.0でEnv生成、Workers types 5.20260911.1、TypeScript5.9.3のstrict checkJs成功。ライブラリ宣言のskipLibCheckは有効。
- [snippet-verification.json](snippet-verification.json): T09/T39/T40/T44/T45のJS/SQL抜粋を実行したfixture/sourceへ空白正規化して照合。日英の表も保存済みの読取り行数/中央値と一致。T42は説明用text図だけで実行コードなし。

D1の三記事はWrangler4.81.1/Miniflare4.20260409.0のgetPlatformProxyを使用。この版のソースのgetMiniflareOptionsFromConfigを読み、configのcompatibility_dateが生成Workerへ渡らないことを確認した。T39本文にも、設定2026-09-11を同日のWorker互換動作の検証として扱えない旨を日英で追記してからHumanizerをやり直した。

DO実験は旧Miniflareで互換日2026-09-11を起動できなかったため、別の一時ディレクトリへWrangler4.131.0をインストール。その依存Miniflare5.20260910.0-alphaの公開型を確認し、convertV4MiniflareOptionsを使って実行した。依存先がalpha版であることも記事に明記。元の個人アプリの依存関係は変更していない。

リポジトリのルートから実行する。D1実験の既定パスは同階層circle-hub-multi-device-push内のWrangler4.81.1だが、末尾引数でscratchの指定版package.jsonも渡せる。DO実験は4.131.0のpath引数が必須。

```bash
node experiments/article-stock-2026-09/node-module-boundaries.mjs
node experiments/article-stock-2026-09/d1-pagination.mjs
node experiments/article-stock-2026-09/d1-idempotency-outbox.mjs
node experiments/article-stock-2026-09/verify-batch04-snippets.mjs
```

DOの再現例は、npmが利用できる環境で以下を使う。ローカルだけの実験でありデプロイしない。

```bash
article_runtime_dir="$(mktemp -d)"
npm install --prefix "$article_runtime_dir" --no-audit --no-fund wrangler@4.131.0
node experiments/article-stock-2026-09/do-partitions.mjs "$article_runtime_dir/node_modules/wrangler/package.json"
```

## 重複と日英の内容確認

日英タイトル完全一致なし。4文字gram類似度で近い既存・新規記事を抽出し、意味で切り口を確認した。類似度は候補抽出用で、閾値による合否ではない。

- T09はPromise組合せの記事と異なり、実ファイルの判定とNodeの読み込み規則を10ケースで切り分ける。
- T39はT37の複合インデックス列順の比較から、同一インデックスでページングを変えたときの読取り行数と途中挿入へ変更。
- T40は初稿の一般的な調整役の説明が既存の出欠同時更新記事に近かったため、Object別保存の横断取得を追加実験して全面的に再構成。出欠の記事を書き直さず、移行前のクエリと参照先の棚卸しへ絞った。
- T42は既存のCronローカル通知テスト手順と異なり、どの単位で再開するかによるサービス選択を扱う。ローカル起動URLの手順を再掲しない。
- T44は既存の予約公開回復記事のクライアント側remote ID保存と異なり、サーバー側の入力指紋・一意制約・同時miss・結果保持後の再送を検証。
- T45は出欠同時更新記事のOutbox提案から、実際のローカルbatchとfake providerへ進め、送信成功とsent保存の間の例外で4ケースを検証。T44の要求結果再利用とは、DBと外部送信の境界で区別。

全6組で問題・確認方法・具体例・結果・制約を対応する英語節へ保持。コードフェンスと出典URLは一致。T39の全測定表、T40の返るレコード、T44/T45の件数と状態を日英で確認。T42のtext図は意味を保って翻訳し、検証案を実行済みと書いていない。一人称の未経験談はない。

Humanizer v2.9.1の[編集計画](humanizer-edits.json)と[監査](humanizer-audit.json)に12ファイルの前後SHA-256、変更文と意味の確認を保存。T40の再構成とT39環境の補足は事実確認段階で行い、その後に監査を作り直した。frontmatter、全コード、URL、数値トークンはHumanizer前後で不変。機械的に検証できない提案/実測/未実装の区別も本文で読み合わせた。

## 最終検証

- `npx zenn list:articles`成功。[出力](zenn-list.txt)に新規6件を確認。
- `node scripts/validate-article-stock.mjs --batch=4`成功。[今回6組](content-validation.json)。必須frontmatter、false、dev.toタグ4件以内、canonical、fences、コード/リンク一致、タイトル重複、予約表除外。
- `node scripts/validate-article-stock.mjs`成功。[完成対象23組](complete-validation.json)にcanonical例外なし。
- [repository-guard.json](repository-guard.json): baseline8a1bfa8の保護対象130ファイルと、batch3までの165記事ファイルがbyte同一。Humanizer最終12ハッシュ一致。
- `git diff --check`とステージ後の`git diff --cached --check`を実施。
- 新規日英12ファイルのpublishedはすべてfalse。予約表、公開workflow、既存記事の本文・公開フラグ・IDは変更していない。
