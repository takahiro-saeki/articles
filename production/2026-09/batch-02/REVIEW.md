# Batch 02: 優先候補の残り6本と追加2本

確認日: 2026-09-11。日英8組を執筆。P02/T20/T36/O07/O10の5組が完成、T01/T31/T37の3組は本文検証済みでcanonical待ち。全体は11/90完成、残り79件。優先12本は9件完成、3件は日英本文あり。

## canonicalの扱い

新規Qiita記事は`id: null`なので、将来の投稿URLを決められない。仮のGitHub URLを使うか、空欄で待つかをユーザーへ質問済みだが回答はまだない。現状は値を捏造せず、英語原稿のcanonicalは空欄、台帳は`執筆中`かつ`canonical_status: URL未確定`。完成へは数えない。

`--allow-pending-canonical`は本文の確認用であり、完成要件の免除ではない。明示された未完成3件の空欄だけを報告し、その他の検査を行う。通常の検証では空欄を許可しない。Zennの5件は予定URLを設定済み。

## 読者に渡す答えと根拠

| ID | 答え | 根拠・検証 | 制約 |
| --- | --- | --- | --- |
| P02 | Projectを分ける前に、そのWorkspaceの管理者へ見せてよいかを決める | Plane公式Workspace/Project/roles/Publishの4ページを照合 | 現行rolesと旧概要にロール名・参加と内容閲覧の説明差あり。差を本文へ明記。会社Workspaceへアクセスせず、権限別の実機確認も未実施 |
| T01 | 集約Promiseが確定する条件を選び、同期throw・空入力・キャンセルとは分ける | B失敗→C成功→A成功、4メソッド、全入力の最終状態、空配列、同期throwをNodeでassert | 実通信、時間計測、キャンセル実装は対象外 |
| T20 | UI操作の入口か、別の呼び出し元へ約束するHTTP仕様かで選ぶ | 実際のlinked-accountsのformとmorning-reminderのPOST。実関数に対する4ケース成功 | Next HTTPサーバー、Actionの通信、Cloudflare binding、通知送信は未検証。共有業務層は提案 |
| T31 | 対象ルートでInsetsを適用するコンポーネントを特定する | root/認証後/public layout、Header/BottomNavを追跡。既存静的テスト2件成功 | Fabric hotfixは依存とQA設定の変更でありpadding修正ではない。実機余白やクラッシュの再現は未実施 |
| T36 | 更新0件はSQL失敗にならず、成功したbatchの後でthrowしても取り消せない | D1ローカルproxyで4ケース。正常順序、重複IDによるrollback、changes 0/1、CHECK違反をassert | 合成スキーマ。行の不存在などCHECKだけで防げない条件を明記。本番・外部送信・並行要求は未検証 |
| T37 | 同じSELECTで列順と検索計画を比べ、返る行も揃える | ローカルD1に10,000行。indexなし/等価先頭/範囲先頭。返るID10件と順序をassert | 時間・読取り課金・本番分布は測定していない。sqlite_version()は拒否され内部版不明 |
| O07 | 一つの条件を意図的に壊して、その反例をテストが検出するか見る | 固定コミットの実ルーター/libSQLテスト。元8成功、条件削除後7成功1失敗 | 故障は一時コピーのみ。HTTPは既存モック。対象差分のAI著作やユーザーの運用経験を推測しない |
| O10 | イベントの保存単位と、テスト・書き出しが対象にするゲームを揃える | 固定コミットのtreeとexport script。bash -n、実シェル＋Godotスタブで起動場所2種類とZIP直下4ファイルを確認 | Git追跡イベントは1件。共通コードはイベント内。ゲームの実exportはしていない。全イベントCI/共通SDKは未実装 |

## 個人リポジトリとGit履歴

- circle-hub-multi-device-push: `0cda1e865ad80d1529197729d8d436e96d56edc7`。通知変更`ad0a669`、先行するアカウント境界修正`8d10923`を確認。Web環境はNext.js 15.5.15 / React 19.2.5 / Vitest 4.1.4。
- circle-hub-android-safe-area-hotfix: `31e560d`。コミット題名はAndroid起動時Fabricクラッシュ防止。実差分は依存/lockfile/QA profile/静的テスト。Expo SDK 54 / React Native 0.81.5 / safe-area-context指定~5.6.0。テストは名前の強い表現とは別に、実際のassertを読んで範囲を限定した。
- game-jam-lab: `f074703848586828b6a5acc0e465ccdd2c0d5244`。関連履歴は`faffd0a`専用itch export、`5198488`launcher退役、`4ea388d`VOLT NOMAD改名、`49a5e18`polish。進行中の未追跡イベントは記事の実装数へ含めない。

## 公式一次資料

- Plane: [Workspace](https://docs.plane.so/core-concepts/workspaces/overview)、[Project](https://docs.plane.so/core-concepts/projects/overview)、[Member roles](https://docs.plane.so/roles-and-permissions/member-roles)、[Publish](https://docs.plane.so/core-concepts/deploy)。公開/非公開の説明を、Workspace内参加とインターネット公開で分けた。
- ECMAScript: [Promise各メソッド](https://tc39.es/ecma262/multipage/control-abstraction-objects.html#sec-promise.all)。節番号の変更に依存しないアンカーを使用。
- Next.js: [Mutating Data](https://nextjs.org/docs/app/getting-started/mutating-data)、[Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers)、[Data Security](https://nextjs.org/docs/app/guides/data-security)。参照時16.3.4表示、テストは15.5.15と明記。
- Android: [edge-to-edge](https://developer.android.com/develop/ui/views/layout/edge-to-edge)。OSとtarget SDKの条件を併記。
- Safe Area Context: [Provider](https://appandflow.github.io/react-native-safe-area-context/api/safe-area-provider/)、[View](https://appandflow.github.io/react-native-safe-area-context/api/safe-area-view/)。Providerとpadding適用を分離。
- D1: [batch API](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch)、[indexes](https://developers.cloudflare.com/d1/best-practices/use-indexes/)、[CLI execute](https://developers.cloudflare.com/d1/wrangler-commands/#execute)。[Wrangler getPlatformProxy](https://developers.cloudflare.com/workers/wrangler/api/#getplatformproxy)はローカルエミュレーションとして利用。
- SQLite: [query planner](https://sqlite.org/queryplanner.html)。COVERINGと検索範囲の違いを実測した計画から説明。

## 実験記録

- [promise-combinators.json](promise-combinators.json): Node v24.15.0、4メソッド、空入力と同期例外。
- [d1-index-verified.json](d1-index-verified.json) / [raw](d1-index-raw.json): indexの3条件、ID列一致。[内部version照会の失敗](d1-version-query-error.json)も保存。
- [d1-batch.json](d1-batch.json): Wrangler4.81.1、Miniflare4.20260409.0、ローカルD1 proxy、4ケース。stderrに出力なし。
- [next-route-entry.json](next-route-entry.json): 実POST関数への4ケース成功。未認証ではDB accessorとPush mockを呼ばない。
- [mutation-check.json](mutation-check.json): 元8成功、故障後7成功1失敗。構文エラーではなくDB期待値の不一致。
- [android-static-tests.json](android-static-tests.json): package指定とQA設定の2件成功。
- [game-jam-layout.json](game-jam-layout.json): コミット済みイベント1、イベント内shared、実行場所2種類で同一対象、ZIP構造確認。

## 重複レビュー

機械的な4文字gramの類似度は候補探しにだけ使った。既存の日本語/英語と今回までの新規原稿を照合し、日英のタイトル完全一致なし。内容は以下を直接比較した。

- P02はP01のプロダクト単位やP03の成果物/期間分類と分け、管理権限と公開範囲を扱う。
- T01は既存`save-successful-results-on-partial-failure`の結果保存・採用状態と重複させず、言語仕様の確定条件を実験する。
- T20は既存のNext.js/Expo認証共有記事と分け、入口の契約と拒否時の実行境界を扱う。
- T31は既存Expo依存不一致記事の修復手順を繰り返さず、Insetsを適用する位置の追跡を扱う。
- T36は既存`d1-no-begin-transaction`のBEGIN拒否/書き方、既存出欠記事の同時更新設計と分け、SQL成功0件の反例とbatch後のthrowを検証する。
- T37はSQLite→D1移行ではなく、固定SELECTに対するindex列順とCOVERINGの読み方を扱う。
- O07はT28の複数端末通知の設計を再説明せず、意図した故障をテストが検知するかを確かめるレビュー手順に絞る。
- O10は既存制作記の工程紹介やO05の決定ログと分け、イベント境界・相対パス・CI対象の固定を扱う。

## 日英とHumanizer

8本とも各節の問題、方法、具体例、結果、制約を英語へ保持した。日本語/英語の実行用フェンス（TSXを含む）と出典URLは機械的に完全一致。説明用text図は意味を合わせて翻訳。数値、固有名、実装済み/提案、確認済み/未確認の対応を本文で照合した。

Humanizer v2.9.1に沿って、抽象的な導入句、過剰な対比、説明を予告するだけの文を編集。[編集計画](humanizer-edits.json)と[監査結果](humanizer-audit.json)を保存。16ファイルでfrontmatter、全コードフェンス、URL、数値トークンが編集前後で同一。最終ファイルのSHA-256も監査結果と一致した。

## 構造検証

- `npx zenn list:articles`: 成功。[出力](zenn-list.txt)に新規Zenn5本を確認。
- `node scripts/validate-article-stock.mjs --batch=2 --allow-pending-canonical`: 8組を検査、3組のcanonical未確定を明示。その他のfrontmatter/flags/tags/fences/snippets/links/タイトルの検査成功。[結果](content-validation.json)。
- `node scripts/validate-article-stock.mjs`: 完成対象11組を、canonicalの例外なしで検証成功。[結果](complete-validation.json)。
- [保全確認](repository-guard.json): 基準`8a1bfa8`にあった記事・予約表・公開workflowなど130ファイルがbyte単位で不変。
- Zenn5件と英語8件は`published: false`。Qiita3件は`ignorePublish: true`、`id: null`。予約表への追加、外部公開、予約実行はなし。
- `git diff --check`とステージ後の`git diff --cached --check`を実施。

次のバッチでも5〜10件を単位に一次資料・実験・日英照合を行う。canonical待ちの3件は値が確定するまで未完成のまま保持する。
