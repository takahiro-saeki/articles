# 第10バッチ: using・Next.js・SQLiteの実行結果を記事にする

2026-09-11。T10、T22、T23、T24、T25、T38の日本語Qiita下書きと、内容を保ったdev.to英訳を作成した。本文・実験・対訳・Humanizerの検証は済んでいる。Qiitaの将来の記事IDは未確定なので、canonical URLはnull、状態は「執筆中」のまま。完成数には加えない。外部での記事作成、公開、予約は行っていない。

このバッチ後は完成41/90、本文検証済み62/90、canonical待ち21、本文の検証が残る候補28。

## 記事ごとの答えと確認範囲

| ID | 読者が持ち帰る答え | 確認した結果 | 制約 |
| --- | --- | --- | --- |
| T10 | disposeを持つ値と解放されるスコープを確認する | 9条件。逆順の解放、return・throw、SuppressedErrorの連鎖、await using、一時ディレクトリ削除。掲載用の2例も別途実行 | 非同期fixtureの待機はPromise.resolve。実通信、別Node版、ブラウザー、強制終了は未検証 |
| T22 | codemod後にmatcherの対象とruntimeを確認する | ファイル・関数名の変換、7 HTTP条件。Proxyへruntime指定を追加するとbuild exit 1 | 最小fixtureの変換。実認証、redirect、全URL、prefetch、クラウド移行ではない |
| T23 | APIの互換性はbuild後のHTTP実行まで確認する | Web API、ファイルAPI、evalをNode/Edgeで比較。Edgeのevalはbuild exit 0、HTTP 500 | 現行版のEdge非推奨を明記。cold start、配置、速度、DB、他社Workersは比較しない |
| T24 | 同じbuildを配るなら値が決まる時点と渡す場所を分ける | 同じBUILD_IDをB/Cで起動。静的server値はbuild時、動的server値は起動時。公開値と別名のliteralも照合 | 別名参照はこの版・ソースの観測。内部最適化の担当箇所は未特定。実行時設定APIは提案で未実装 |
| T25 | img属性・currentSrc・レスポンスを別々に確認する | 同じ合成PNG、CSS幅640。sizesなしは幅384、50vw指定は640を取得。lazy前後と本文byte数も記録 | DPR 1、viewport 1280×720のみ。写真の圧縮率、画質、LCP、CPU、CDNは未測定 |
| T38 | 外部キーの有効状態と子を探すindexを別々に確認する | 4条件。FKだけでは子indexなし。親DELETEの子側計画が明示indexでSCANからSEARCHへ変化 | ローカルSQLiteの合成データ。処理時間、リモートD1、ORM migrationは未検証 |

## 一次資料

2026-09-11に現行公式ページの本文を確認した。今回は準備B/Cの候補で、個人アプリでの実体験には置き換えていない。

- T10: [ECMAScriptの宣言とスコープ](https://tc39.es/ecma262/multipage/ecmascript-language-statements-and-declarations.html#sec-let-and-const-declarations)、[TC39のSuppressedError設計](https://github.com/tc39/proposal-explicit-resource-management#the-suppressederror-error)、[Node.js 24.15.0のmkdtempDisposableSync](https://nodejs.org/download/release/v24.15.0/docs/api/fs.html#fsmkdtempdisposablesyncprefix-options)。解放の登録・スコープ退出、例外の関係、24.4.0でのAPI追加を照合。
- T22: [Proxy移行](https://nextjs.org/docs/app/api-reference/file-conventions/proxy#migration-to-proxy)、[matcher](https://nextjs.org/docs/app/api-reference/file-conventions/proxy#matcher)、[runtime](https://nextjs.org/docs/app/api-reference/file-conventions/proxy#runtime)。名前の意図、配置、変換、Node.jsとruntime指定禁止を確認。
- T23: [Edge API](https://nextjs.org/docs/app/api-reference/edge)、[未対応API](https://nextjs.org/docs/app/api-reference/edge#unsupported-apis)、[Edge非推奨の移行案内](https://nextjs.org/docs/messages/edge-runtime-deprecated)。一般APIページと現行Proxyの実行環境を混同しない。
- T24: [ブラウザー向け環境変数](https://nextjs.org/docs/app/guides/environment-variables#bundling-environment-variables-for-the-browser)、[実行時環境変数](https://nextjs.org/docs/app/guides/environment-variables#runtime-environment-variables)。直接参照の埋め込み、動的描画での読込、間接参照の公式例と実際の出力を比較。
- T25: [Imageのsizes](https://nextjs.org/docs/app/api-reference/components/image#sizes)、[loading](https://nextjs.org/docs/app/api-reference/components/image#loading)。密度・幅候補の違いと既定のlazyを照合。
- T38: [SQLiteの外部キーとindex](https://sqlite.org/foreignkeys.html#fk_indexes)、[EXPLAIN QUERY PLAN](https://sqlite.org/eqp.html)。親の一意性、子側検索と推奨index、接続の外部キー設定、計画の出力形式の制約を確認。

## 再実行と成果物

Node.js 24.15.0、Next.js / @next/codemod 16.3.4、インストールしたReact / React DOM 19.3.0、Python 3.14.5、SQLite 3.53.1、macOS arm64、Headless Chrome 152。Next.jsはwebpackのproduction build、cacheComponentsとReact Compilerは無効。

```sh
npm ci --prefix experiments/article-stock-2026-09/next-batch10 --no-audit --no-fund
node experiments/article-stock-2026-09/using-resource-disposal.mjs
node experiments/article-stock-2026-09/using-order-example.mjs
node experiments/article-stock-2026-09/using-directory-example.mjs
python3 experiments/article-stock-2026-09/sqlite-foreign-key-child-index.py
python3 experiments/article-stock-2026-09/run-next-batch10.py
python3 experiments/article-stock-2026-09/verify-batch10-article-evidence.py
```

ブラウザー実験はPlaywrightスキルの`~/.codex/skills/playwright/scripts/playwright_cli.sh`を使う。別環境ではrunner内のパスを合わせる。依存は専用ディレクトリに固定し、ルートのpackageファイルを変えていない。Next.jsのbuildと画像は一時ディレクトリ、HTTPサーバーは127.0.0.1の一時ポート。テスト後にブラウザーとサーバーを終了する。一時ディレクトリ削除の実験も、この処理で新規作成したディレクトリだけを対象にする。

- [using-results.json](using-results.json)、[using-article-examples.json](using-article-examples.json): 9条件の順序・例外・存在確認と、掲載用2例のstdout・exit。
- [sqlite-results.json](sqlite-results.json): 4条件のindex、実際の親DELETEの計画、制約違反、削除成功、孤児行の検出。
- [next-environment.json](next-environment.json)、[next-run.log](next-run.log): 実際のversion・userAgentと最終実行の完了記録。
- [proxy-codemod.json](proxy-codemod.json)、[proxy-http-results.json](proxy-http-results.json): 変換前後の全文と7リクエスト。
- [runtime-http-results.json](runtime-http-results.json)、[negative-build-results.json](negative-build-results.json): 成功時の値と、Proxy runtime・Edge file・Edge evalのbuild/HTTP結果。後者から各エラーログを特定できる。
- [next-env-results.json](next-env-results.json)、[client-bundle-evidence.json](client-bundle-evidence.json): 同じbuildのB/C表示と、クライアントchunkのliteral・動的参照の抜粋とSHA。
- [image-results.json](image-results.json): 合成PNGの寸法・byte・SHA、スクロール前後のDOM属性・currentSrc、取得URLの再GET、Resource Timing。
- [snippet-verification.json](snippet-verification.json): 14コードブロックを実行済みファイル・codemod出力・SQLite入力と照合し、上記の記録を再assert。
- [ブラウザー成果物](../../../output/playwright/batch10-next): 初期試行を含むナビゲーション時のsnapshot。最終結果は上記JSONを使い、試行数を検証条件へ加算しない。

最初は別名経由の公開環境変数がnullになると予想していたが、ブラウザーではbuild時の値が見えた。[first-env-observation.json](first-env-observation.json)を残し、生成chunkを追加確認してからB/Cを含む全工程を再実行した。予想に合わせて観測値を変更していない。

Edge evalもbuild失敗と予想したが、実際にはbuildが通った。起動後のHTTPとサーバーログの確認を追加して500とEvalErrorを記録した。記事はこの差を結果として扱う。codemodの初期起動パス誤りは、固定したパッケージ内の実在するbinへ修正した。

T25のbyte数は同じAccept指定でcurrentSrcを再GETしたレスポンス本文の大きさ。最適化した上段2枚はResource TimingのencodedBodySizeとも一致する。Resource TimingはinitiatorTypeがimgのものだけを抽出しており、通常imgがその一覧にないことを「未取得」と解釈しない。DOMの読込状態と再GETを併せている。

## 対訳・重複・Humanizer

日英の全節、表、コード、結果、制約を照合した。英語版を要約にせず、実験用コードと実装したい設計の区別も保った。12原稿の公開抑止フラグ、タグ数、fence、日英コード・URL一致を検査している。

既存のD1複合index記事は通知検索の列順が対象で、T38の外部キーによる親削除時の子検索とは異なる。OpenNext/Next 16の既存デプロイ記事はCloudflareでの移行問題で、T23はローカルruntimeのAPI互換性。第7バッチのNext.jsキャッシュ記事は描画・データ・ルーターの取得回数で、T24は同じbuildの値の固定時点を扱う。

今回のT22/T23は同じ環境を共有するが、matcherとcodemod後の制約、依存APIのbuild/HTTPという別の答えに絞った。T10は既存AbortController記事のキャンセル通知ではなく、scopeに登録したdisposeの契約が対象。タイトル完全一致はなく、類似度の近接候補もこれらの切り口で確認した。

Humanizerスキルv2.9.1のファイルモードでdraft→audit→finalを12ファイルへ適用した。回りくどい告知文や長い否定を直接の説明に変え、英語の数値前後の空白も整えた。28箇所の編集後、コード・数値・URL・frontmatterと日英の意味を照合した。

- [humanizer-edits.json](humanizer-edits.json)、[humanizer-audit.json](humanizer-audit.json): 手動推敲、意味のレビュー、保護要素の不変性と最終SHA。
- [content-validation.json](content-validation.json): canonical未確定だけを明示的に除いた6組の本文用ゲート。
- [canonical-gate.json](canonical-gate.json): canonical例外なしの完成ゲートでは期待どおり失敗。
- [complete-validation.json](complete-validation.json): 既存完成41組は例外なしで通過。
- [zenn-list.txt](zenn-list.txt): `npx zenn list:articles` exit 0。今回の新規日本語原稿はQiita用。
- [repository-guard.json](repository-guard.json): 制作開始前137ファイルと直前の235記事ファイルがbyte単位で不変。アイデア表も進捗ブロックを除いた原文の一致を確認。

`git diff --check`と`git diff --cached --check`を通過。予約表、workflow、既存記事は変更しない。正規のcanonical URLかユーザーの方針回答が得られるまで、今回の6組は本文検証済みの「執筆中」として保持する。
