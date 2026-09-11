# 第15バッチ: 起動時の準備、AppState、応答後の処理とキャッシュ

2026-09-11。T29、T32、T35、T41、T43のQiita日本語下書きとdev.to英訳を作成した。5組の本文・日英・Humanizerを検証済み。これで90候補すべての日英本文が揃った。完成41/90、本文検証済み90/90、canonical待ち49。未確定のQiita IDを推測せず、49件は状態「執筆中」、canonical_urlはnullを維持する。公開、外部下書き作成、予約表への追加はない。

## 記事ごとの答えと範囲

| ID | 読者が持ち帰る答え | 実行・確認したこと | 未確認・未実装のこと |
| --- | --- | --- | --- |
| T29 | 初期URLの結果と、起動後のurlイベントを別に記録する | Router 6.0.24の実JSで同期iOS取得、Androidの取得・150 msタイマーの順序、reject、初期Promiseの再利用、別のruntimeイベント。ReleaseアプリのURLなし起動2回 | Androidの実時間計測、ネイティブのリンク配送、元アプリのURL取りこぼし |
| T32 | changeの状態とAndroidのfocus・blurを別に扱う | RN 0.81.5の実JSへ6条件を入力、nativeのOS別対応付け、実badge effectの代替API呼び出し。iOSで起動時inactiveとbackgroundを観測 | 完全な前面復帰の一巡、Android通知ドロワーの実機操作、実バッジ、重複処理制御の導入 |
| T35 | hideの条件に最初に表示する内容の準備を含める | iOS Releaseをビルドし、earlyとcoordinatedの2起動でfont/auth/layout/hideの順序を比較。preventの結果は両方true | 画面の目視・フレーム測定、白画面の時間、Android、元アプリへの修正適用 |
| T41 | 202と後続処理の成功を別々に観測する | local workerdでawaitとwaitUntil、独立した失敗、catchによる失敗記録、35秒の代替依存、掲載コードの実行 | Cloudflare本番の30秒制限再現、切断、Queue、実通知、記録の配送保証 |
| T43 | 削除結果とともにWorker到達回数を見る | local workerdと実Chromiumの4保存条件、削除とreload、put/matchの3ヘッダー、CacheStorage、掲載コード | Cloudflareの各拠点、Tiered Cache、期限切れ、追い出し、実サービスの設定変更 |

## 一次資料と実装の固定

準備Cの5件について、可能な範囲で実行環境と比較コードを用意した。元アプリを修正せず、個人リポジトリの固定コードを題材とした。[repository-sources.json](repository-sources.json)にcircle-hubの固定commit `a34608c611ded6549c1176a7977e68e1bc62a8db`、8ファイルのSHA・バイト数・直近変更履歴を保存。ルートとアプリ側レイアウト、通知、focus時の再取得、設定、package.json、entry、サーバー通知処理を確認した。

- [React Native Linking](https://reactnative.dev/docs/linking): 初期URLと起動後のイベント。
- [Expo linking guide](https://docs.expo.dev/linking/into-your-app/): Routerに組み込まれたリンク処理と手動購読の区別。
- [React Native AppState](https://reactnative.dev/docs/appstate): iOS inactive、Android focus/blur、legacy architectureでの初期null。現在の説明を固定0.81.5のJS・Objective-C・Kotlinと照合。
- [Expo SplashScreen](https://docs.expo.dev/versions/latest/sdk/splash-screen/): グローバルでのprevent呼び出し、hideとhideAsync、SDK 52以降のExpo Go・開発ビルドとReleaseの差。最新の~57.0.8と実験31.0.13を区別。
- [Workers Context](https://developers.cloudflare.com/workers/runtime-apis/context/): waitUntilの寿命、独立したPromise、応答後の観測。
- [Workers Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/): Responseのヘッダー、putの返り値と保存の区別、拠点ごとの保存・削除、Tiered Cache。
- [RFC 9111](https://httpwg.org/specs/rfc9111.html#storing.responses): privateとno-storeの保存条件。
- [Miniflare Cache](https://developers.cloudflare.com/workers/testing/miniflare/storage/cache/): ローカルのキャッシュ環境。古いコンストラクタ形式をそのまま使った最初の試行はMF5のvalidationで失敗し、exportされたconvertV4MiniflareOptionsで変換した。
- [Workers best practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/): compatibility date、型生成、ctx、ログの扱い。
- [Queues retries](https://developers.cloudflare.com/queues/configuration/batching-retries/): 再配送を検討する先として参照。Queueは実装・実行していない。

モバイル用の一次コードはnpmの固定パッケージから読み、[mobile-package-sources.json](mobile-package-sources.json)に公式repository情報・gitHead・tarball integrityを保存。実行対象8ファイルのhashはmobile-js-experiment.jsonにある。題材リポジトリのRouter宣言5.0.7と、比較用SDK 54で実行した6.0.24は異なる。固定版の挙動をすべての現行SDKへ一般化していない。

WorkersはWrangler 4.131.0、依存するMiniflare 5.20260910.0-alphaとworkerd 1.20260910.1。最新型5.20260911.1を取得・確認し、wrangler typesでEnvを生成。TypeScript 7.0.2のstrict検査が成功した。[worker-typecheck.json](worker-typecheck.json)に最終Workerのhashを記録。

## 実験結果と実行範囲

- [mobile-js-experiment.json](mobile-js-experiment.json): Router 6条件、AppState 6条件。実パッケージのJavaScriptを実行し、ネイティブ・時計・イベント境界を代替。タイマーへ渡された150を照合し、順序を制御した。端末が150 msで返したという計測ではない。初期Promiseの遅延解決とruntimeイベントは別に発火。実badge effectはマウント1、指定の復帰列の後に合計2、blur・解除後は増加なし。
- [mobile-native-experiment.json](mobile-native-experiment.json): task専用iOS 26.5 SimulatorでRelease起動2回。earlyはhide-request→auth-ready→content-layout、coordinatedはauth-ready→content-layout→hide-request。両方font成功・prevent結果true、URLなしの初期取得null。fixtureとcollectorの5hash、JS bundleのhashを保存。
- [mobile-events.ndjson](mobile-events.ndjson): 受信した生の記録。配送順は一部入れ替わるため、bootごとにsequenceで整列して比較。elapsedはperformance.nowの生値で、起動からの所要時間とみなしていない。
- [native-attempt.json](native-attempt.json): Expo Goのプロジェクトは起動できず、GUIツールがMacのロックを報告した。その後に独立したReleaseアプリをCLIでビルド・起動して上記の記録を取得。画面の目視や最初の表示フレームは未確認。openurlコマンドは成功終了したが、URL受信・新たな起動ログを確認できなかったため配送成功とは数えない。AppStateはinactiveからbackgroundの一部だけで、完全な復帰操作ではない。
- [ios-build-summary.json](ios-build-summary.json): Release成功、Xcode版、元ログのサイズとhash、警告の抜粋。依存のdeprecated、documentation、Hermesの未宣言グローバル等の警告は残る。警告なしのビルドとは報告しない。約9 MBの全ログは生成済みiOSディレクトリへ移してGit対象外とし、Podsのlockfileと導入ログは別に保存。
- [workers-runtime-experiment.json](workers-runtime-experiment.json): await中には本文を読めず、waitUntilでは202を先に読めた。失敗と別の成功Promiseは独立し、明示catchでは失敗記録が残る。35秒の保留後もローカルでは完了したが、Cloudflareの30秒制限を再現していない。handleUncaughtErrorの配列が空であることを、失敗なしの証拠にはしない。
- [cache-browser-experiment.json](cache-browser-experiment.json): HeadlessChrome 152の通常fetch。none/worker/browser/bothの到達・取得回数は2/2、2/1、1/1、1/1。bothでWorker側delete成功後も1/1、reload後2/2。明示CacheStorageとHTTPキャッシュも別に確認。リクエストのinterceptionやHTTPキャッシュの強制無効化はしていない。
- [printed-worker-experiment.json](printed-worker-experiment.json): 原稿から抽出したTS 2ブロックとJS 1ブロックを独立workerdで実行。202の後に失敗が記録され、保存用publicと返却用no-storeは別に保たれた。
- [printed-browser-experiment.json](printed-browser-experiment.json): 原稿のJSを実ブラウザでそのまま実行。consoleだけ記録用に差し替え、2本文がgeneration-1、到達・取得は1/1。
- [snippet-verification.json](snippet-verification.json): 日英全9フェンス一致、実行用8・text 1。モバイルの掲載4ブロックは境界を代替して実行し、Releaseに使った元コードとの一致も確認。workerd・browserの保存済み実行結果、Git8・package8・native fixture5hash、Humanizer最終hashを照合。

各再現環境のREADMEに導入・実行・終了手順を保存。ネイティブの再実行はiOSプロジェクトの生成とローカルビルドが必要で、JS境界のテストとは別。Cloudflareやストアへは送らない。

## 重複、対訳、Humanizer

既存の通知cold startフリーズ記事と照合し、T29をURL初期取得とruntimeイベント、T35をfont/auth/layout/hideの順序へ絞った。既存の認証と通知遷移の修正を新たな体験として繰り返していない。T32のfocusはAndroidのwindow focusで、画面単位のnavigation focusと混同しない。T43はNext.jsのキャッシュ記事と異なり、Worker削除後もブラウザに残る応答を到達回数で調べる。T41はOutboxの設計導入とは分け、waitUntilのローカル観測を扱う。

5組すべてについて節、表、具体例、結果、未確認範囲を対訳で照合した。Humanizer v2.9.1のdraft→audit→finalを適用し、10原稿24箇所を手動推敲。結論を予告する定型文や抽象的な重要性の表現を減らし、著者本人が実行したと読める一人称を使っていない。[humanizer-edits.json](humanizer-edits.json)と[humanizer-audit.json](humanizer-audit.json)に変更と前後hashを保存。frontmatter、全コード、URL、順序付き数値トークンは不変。最終原稿のhashも検証した。

## 完成ゲートと保護

本文ゲートは未確定canonicalだけを明示して除外し、5組成功。例外なしの完成ゲートでは5組ともcanonical未確定で失敗することを確認した。完成41組については例外なしの既定検証が成功。Zenn一覧、frontmatter、tags、fences、canonical、重複、git diff --checkを確認した。

[repository-guard.json](repository-guard.json)では制作開始前137ファイルとバッチ直前293記事ファイルがbyte一致。候補表も生成進捗ブロック以外は保持。既存公開記事・公開フラグ・予約表・workflowは変更していない。

[cleanup.json](cleanup.json)にtask専用Simulator削除、元のSimulatorが引き続きBooted、ローカル3ポート終了を記録。ブラウザセッションと実験用CacheStorageは各スクリプトのfinallyで終了・削除。個人・会社の実サービス、物理端末は操作していない。

Qiitaの将来の公開URLが確定するまでは、本文が揃っても49件を完成とは扱わない。
