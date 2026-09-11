# 第9バッチ: Reactの入力・購読・Actionをブラウザーで確認する

2026-09-11。T11、T12、T13、T15、T16、T17の日本語Qiita下書きと、内容を保ったdev.to英訳を作成した。本文・実験・対訳・Humanizerの検証は済んでいる。Qiitaの将来の記事IDは未確定なので、canonical URLはnull、状態は「執筆中」のまま。完成数には加えない。外部での記事作成、公開、予約は行っていない。

このバッチ後は完成41/90、本文検証済み56/90、canonical待ち15、本文の検証が残る候補34。

## 記事ごとの答えと確認範囲

| ID | 読者が持ち帰る答え | 確認した結果 | 制約 |
| --- | --- | --- | --- |
| T11 | keyの問題は表示値と行の同一性を分けて調べる | 6条件。先頭削除後、index版のDOM・行stateは値がずれ、親state版は値が正しくてもnodeは別行から再利用された | 本番不具合の体験ではない。focus、IME、DatePickerは未測定。既存画面へのID追加は提案 |
| T12 | setup回数だけでなく、cleanupと最後に残る購読を確認する | 5条件。開発root Strict Modeの正常版はsetup/cleanup/setup。cleanupなしは登録数2→3→3 | ローカルSetのhandler。実通信・決済・メール送信へ一般化しない |
| T13 | controlledの選択とstate配置を分けて設計する | 9条件。10・100・500項目で親管理は全欄、個別stateは1欄、DOM保持は0欄の追加呼び出し。FormDataとresetも比較 | 固定した独立入力のリスト。呼び出し回数であり速度・FPS・メモリではない |
| T15 | 通知に加えてsnapshotの参照とSSR初期値を揃える | store比較1、hydration比較2。直接変更ではstore=1、DOM=0。新snapshotでは2。SSR初期値不一致は最終表示だけでは見落とす | tearing、streaming SSR、常に新snapshotを返すループは未実行 |
| T16 | DOM nodeとref callbackの同一性を別々に確認する | ブラウザー6条件、型3条件。同じnodeでも新callbackならcleanup/attach。Map・booleanの暗黙戻り値はTS2322 | observer数は実験側の登録記録。内部リソース量やstate更新ループは測定しない |
| T17 | Actionの結果と失敗時に残す入力をそれぞれ設計する | 9条件。invalidをreturnしてもinputはreset。入力を結果へ含める修正を確認。queueの次のpreviousと中間DOMも比較 | クライアント関数と手動Promise。Server Function、permalink、認証・永続化・通信時間は未検証 |

## 一次資料と個人リポジトリ

2026-09-11に現行公式ページの本文を確認した。記事は引用の寄せ集めにせず、自作の比較入力と観測結果を中心にした。

- T11: [リストとkey](https://react.dev/learn/rendering-lists#keeping-list-items-in-order-with-key)。削除・挿入・並べ替え時の項目の対応付けを照合。
- T12: [Strict Mode](https://react.dev/reference/react/StrictMode)、[useEffect](https://react.dev/reference/react/useEffect)。root配置による初回Effectの差と、依存変更時のcleanupを照合。
- T13: [input](https://react.dev/reference/react-dom/components/input)、[form](https://react.dev/reference/react-dom/components/form)。controlledの更新とstate配置、FormDataを確認。
- T15: [useSyncExternalStore](https://react.dev/reference/react/useSyncExternalStore)、[SSR](https://react.dev/reference/react/useSyncExternalStore#adding-support-for-server-rendering)。snapshotの再利用・不変性と、サーバーからhydrationへ渡す初期データの契約を確認。
- T16: [callback ref](https://react.dev/reference/react-dom/components/common#ref-callback)、[React 19移行時の型変更](https://react.dev/blog/2024/04/25/react-19-upgrade-guide#ref-cleanups-required)。導入時の説明と現行runtime・型の検証を区別。
- T17: [useActionState](https://react.dev/reference/react/useActionState)、[form](https://react.dev/reference/react-dom/components/form)。previous、pending、ActionのTransitionとuncontrolled inputのresetを照合。

T11の準備Aでは、個人リポジトリcircle-hubのcommit `770de5f2989775cfd95f7a9c4529565a2b48d2fd`をGitオブジェクトから読んだ。`apps/web/src/app/(app)/organizations/[id]/schedules/new/page.tsx`のCardはindex keyだが、タイトル入力は親stateのcontrolled input。`removeRow`、`duplicateRow`、ScheduleRowの定義も確認した。

関連するpathの最新commit `a136487f8e5ac1e8cc603025d823f3e8444de594`、path移動commit `494e96304d616ec2e544125eb8e204bfb4290280`と設計資料`docs/design-system.md`を確認した。path移動を機能の初回実装とは扱わず、設計資料の一括入力UXの記述をkey不具合の証拠とも扱わない。固定ファイルのSHAと範囲は[repository-source.json](repository-source.json)。既存アプリの実行・編集・データ送信はしていない。

## 再実行と成果物

Node.js 24.15.0、React / React DOM 19.3.0、esbuild 0.28.2、TypeScript 7.0.2、React型19.3.0、macOS arm64、Headless Chrome 152。React Compilerなし。build・Strict Modeの違いは各ケースへ記録した。

```sh
npm ci --prefix experiments/article-stock-2026-09/react-batch09 --no-audit --no-fund
node experiments/article-stock-2026-09/react-batch09/check-ref-types.mjs
python3 experiments/article-stock-2026-09/run-react-batch09.py
python3 experiments/article-stock-2026-09/verify-batch09-article-evidence.py
```

ブラウザー実験はPlaywrightスキルの`playwright_cli.sh`を使用する。runner内のCLIパスはこの環境の`~/.codex/skills/playwright/scripts/playwright_cli.sh`。別環境ではパスを合わせる。依存は専用ディレクトリに固定し、ルートのpackageファイルを変えていない。bundleとHTMLは一時ディレクトリ、HTTPサーバーは127.0.0.1の一時ポート。テスト後にブラウザーとサーバーを終了する。

- [browser-results.json](browser-results.json): 最終38条件。値・nodeの出自・呼び出しログ・登録数・FormData・reset・Action状態・hydrationエラーを収録。
- [browser-run.log](browser-run.log): 全条件の実行ログと完了記録。
- [environment.json](environment.json): 実際のversion、userAgent、renderToStringのHTMLとgetServerSnapshot欠落時の例外。
- [ref-type-results.json](ref-type-results.json): 3入力、exit、診断番号と診断文。
- [snippet-verification.json](snippet-verification.json): 記事の14コードブロックを実行済みfixture・型検査入力・SSR出力と照合し、38条件の記録を再assert。
- [ブラウザー成果物](../../../output/playwright/batch09-react): ナビゲーション時のsnapshotとconsole記録。意図したthrowとhydration不一致はアプリの観測用handlerで収集した。

最初の36条件は通過したが、Actionの検証エラー時に入力を失う観測だけでは対処例が足りなかった。結果stateへinputを含める版を追加し、invalid時に保持、成功時に空へ戻る2条件を加えた。最終38条件を通しで再実行している。[first-run](first-run)は追加前の記録で、最終結果には加算しない。

T11初稿の「indexを使った6条件」という表現は、indexの条件が全6条件中の一部であることと合わないため修正した。T13は項目数と順序を固定し、削除・挿入・並べ替えを含めない制約を日英へ追加した。どちらもHumanizer監査より前に事実確認として修正した。

## 対訳・重複・Humanizer

既存の画像プレビューのstate更新ループ記事、React 16.7 alpha時代のHooks/Context記事、今回の制作で作ったmemo化コストの記事を確認した。T16はrefの解除契約と型、T15は外部snapshotとSSR、T13はstate配置・送信・resetを中心にし、既存記事の再説明を避けた。

タイトルの完全一致はなく、自動類似度の近接候補も確認した。同じReactの用語や検証環境を共有していても、対象操作と結論は異なる。類似度だけで重複を判断していない。日英は全節の問題・比較手順・表・コード・結果・制約を照合し、要約にはしていない。実験の実施をユーザーの過去の運用体験として書いていない。

Humanizerスキルv2.9.1のファイルモードでdraft→audit→finalを12ファイルへ適用した。「ここで確認する答え」「結論は」といった告知文を直接の説明へ変え、長い否定や過剰な比較表現を整理した。

- [humanizer-edits.json](humanizer-edits.json): 手動で選んだ推敲と意味の照合記録。
- [humanizer-audit.json](humanizer-audit.json): frontmatter、コード、URL、順序付き数値トークンの不変性と最終SHA。
- [content-validation.json](content-validation.json): 今回の6組の必須項目、公開抑止、タグ上限、fence、日英コード・URL一致、重複スクリーニング、予約表未追加。canonical未確定だけを明示的に除いた本文用ゲート。
- [canonical-gate.json](canonical-gate.json): canonical例外なしの完成ゲートでは期待どおり失敗。
- [complete-validation.json](complete-validation.json): 既存完成41組は例外なしで通過。
- [zenn-list.txt](zenn-list.txt): `npx zenn list:articles` exit 0。今回の新規原稿はQiita用。
- [repository-guard.json](repository-guard.json): 制作開始前137ファイルと、このバッチ直前の223記事ファイルがbyte単位で不変。アイデア表の進捗ブロックは管理上の例外。

`git diff --check`と`git diff --cached --check`を通過。公開済み記事、公開フラグ、予約表、workflowは変更しない。正規のcanonical URLかユーザーの方針回答が得られるまで、今回の6組は本文検証済みの「執筆中」として保持する。
