# Batch 02 調査引継ぎ（執筆前）

2026-09-11。対象は優先12本の残り T31/T37/T20/T01/O07/O10。Batch 01は5a69493でpush済み。現在6/90完成。90件のgoalはactive。

## 共通の未解決事項

Qiita向けの将来の投稿IDは取得できず、canonical_urlの仮置き方針をユーザーへ非同期質問済み。質問は「GitHubの日本語原稿URLを仮設定して公開時に差し替える」または「空欄でURL待ち」。まだ回答はない。IDや将来のQiita URLを生成しない。独立した執筆/実験は進めてよいが、canonicalの例外を承認されたと扱わない。

## T31 Android Safe Area

- 個人作業コピー: circle-hub-android-safe-area-hotfix。HEAD 31e560d。
- 31e560dはFabric起動クラッシュ対応で、package、lockfile、QA profile、android-native-runtime.test.tsを変更。padding/insetsを直したコミットではない。c2a0482でmerge。
- apps/mobile/app.config.tsにedgeToEdgeEnabled: true。
- rootはSafeAreaProvider、認証済みlayoutはView + Header + Stack + BottomNav。
- HeaderがpaddingTop: insets.top、BottomNavがpaddingBottom: insets.bottomを適用。個別画面のSafeAreaViewとの組合せを調べる余地あり。実機で二重paddingを再現したとは言わない。
- SDK54、RN0.81.5、safe-area-context ~5.6.0。既存のpackage不整合記事と重複しないよう、画面の適用箇所を読む調査へ焦点を寄せる。
- vitest src/lib/android-native-runtime.test.ts は2/2成功（Vitest4.1.4）。中身はpackage指定とQA設定の文字列確認であり、クラッシュ自体や画面の回帰テストではない。
- 公式資料確認: https://developer.android.com/develop/ui/views/layout/edge-to-edge （Android15以上＋target35以上、system/gesture/cutout insets）
- https://appandflow.github.io/react-native-safe-area-context/api/safe-area-view/ （paddingへの加算、edges等）

## T37 D1複合index

- Wranglerスキル読了: /Users/takahiro_saeki/.agents/skills/wrangler/SKILL.md。ユーザーへ使用宣言済み。
- 既存CLI: /Users/takahiro_saeki/Documents/GitHub/circle-hub-multi-device-push/apps/web/node_modules/.bin/wrangler
- 実行版4.81.1、Node v24.15.0。必ず --local と専用config/persist先を指定。クラウドへの作成/操作は行っていない。
- 実験ファイル: experiments/article-stock-2026-09/d1-index/{wrangler.jsonc,compare.sql}
- local persistence: /tmp/article-stock-d1-index-lab
- 最初にSELECT sqlite_version()を試したがD1に拒否された。d1-version-query-error.jsonに保存。SQLite内部版は不明のままにする。
- sqlite_version()を外して再実行成功。fixture10,000行。indexなしではSCAN + TEMP B-TREE、(user_id,created_at)ではSEARCHの条件がuser_id=? AND created_at>?、逆順ではcreated_at>?のみ。
- 両indexの抽出行数10、id合計94,920。raw結果はd1-index-raw.json。今後はassertスクリプトで結果/ID集合まで検証するとよい。
- 比較は検索計画。時間差・本番D1料金差・読取り行数などはまだ測っていない。
- 元のcircle-hub schemaにnotification_user_idxとnotification_created_idxがあり、user/dateの例を題材にできる。簡略化したfixtureで本番スキーマを変更したとは言わない。
- 公式: https://developers.cloudflare.com/d1/best-practices/use-indexes/ 、 https://developers.cloudflare.com/d1/wrangler-commands/#execute 、 https://sqlite.org/queryplanner.html

## T01 Promise

- experiments/article-stock-2026-09/promise-combinators.mjsを実行済み、結果promise-combinators.json。
- Node v24.15.0、Promise.withResolversで完了を制御。入力A/B/C、完了B失敗→C成功→A成功。
- allとraceはBでreject、anyはCでfulfill、allSettledはA成功/B失敗/C成功を入力順で返す。すべて残りのタスクも完了する。
- 空配列: all/allSettledは[]、anyはerrors0件のAggregateError、raceはpending。jobs.mapの同期throwはallSettledに届く前にthrow。Promise.resolve().then(fn)経由は結果配列に含む。
- 実時間ベンチマークではない。保存・再試行を主題とする既存save-successful-results-on-partial-failureと重複させない。
- 仕様URL: https://tc39.es/ecma262/multipage/control-abstraction-objects.html#sec-promise.all 。単一ページURLは取得できずmultipage版を確認。2027ドラフト表示で節番号が27.5に移っているため数字の節番号は固定しない。

## T20 Server Actions / Route Handlers

- 対象circle-hub-multi-device-push（0cda1e8）のapps/web。
- packageのnext指定^15.2.3、実インストールNext15.5.15、React19.2.5。最新公式ページは16.3.4表示。検証環境と公式の対象を混同しない。
- settings/_components/linked-accounts.tsxのform action内にuse server + signIn(p.id,{redirectTo:'/settings'})。
- api/cron/morning-reminder/route.tsはPOST Requestを受け、secret未設定500、不一致401、その後にDB/送信。上部の「Cronは1回だけ発火」コメントは無検証なので引用しない。
- 公式: https://nextjs.org/docs/app/getting-started/mutating-data 、 https://nextjs.org/docs/app/getting-started/route-handlers 、 https://nextjs.org/docs/app/guides/data-security
- updating-data URLは404。公式ナビゲーションからmutating-dataへ移動。
- 確認内容: ActionsはPOST、直接呼ばれる入口なので認証認可が必要。pageのチェックはactionへ継承されない。Route HandlerはRequest/Responseを扱う。共通の業務関数を入口から呼ぶ提案にするとよい。まだ実験fixture未作成。

## O07 AIコードの確認

- まだ専用の原稿/実験はない。T28の実routerテストなどの根拠はbatch01を参照できるが、同じコード解説にせず「守る条件→反例→テストで検出できるか」の読者手順にする。
- コードがAI作成だったことをGit作者名だけで推測しない。これは確認手順案として明記できる。

## O10 Game Jam基盤

- game-jam-lab HEAD f074703。Godot 4.6.2.stable.official.71f334935インストール済み。
- root READMEはpermanent labと記載、events配下のイベント単位のGodot/docs/tools/submission構造。
- 手元には3イベント（AI Browser Game Jam 4、Micro Jam 063、Week Sauce August）。Git追跡状態も確認し、未追跡の作業をコミット済みとは書かない。
- root共通toolsディレクトリはない。イベントごとtoolsを保持しており、共通ライブラリとして抽出済みという候補の前提は未確認。
- .github/workflowsはAI Browser Game Jam 4のパスを固定してスモーク/書き出し/Pages公開。全イベントを自動で検証する仕組みではない。
- 旧プロトタイプが現在もlauncherで遊べるかはREADMEだけで判断しない。smoke_test.gdは直接VOLT NOMAD起動とretired game labが出ないことを検証。
- Godotの実行テストはまだこのbatchでは行っていない。コードの読むだけと実行を区別する。
