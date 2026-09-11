# 第7バッチの制作・検証記録

確認日: 2026-09-11。P20 / T18 / T19 / T21 / T34 / O25の日英6組。すべてZenn向け。公開・予約は行わない。

## 読者へ残す答えと検証範囲

| ID | 絞った答え | 確認した内容 | 確認していない内容 |
| --- | --- | --- | --- |
| P20 | セルフホストの比較に復元結果の確認作業を入れる | 公式料金・Edition、固定Composeの13 service定義、未変更restore.shへ4条件を模擬入力 | Plane本体起動、実DB/添付/volume復元、CloudのSLA、保守時間・総費用 |
| T18 | 初回と再取得を分け、境界位置・Transition・keyで残す画面を決める | production Reactの5条件で初回/更新中/解決後DOM、全条件の入力保持 | 実通信、サーバーstreaming、paint、ちらつき時間、実ユーザーのUX |
| T19 | 境界数よりclient importへ入る依存を測る | 同じ画面の3構成、256行一致、2ボタン操作、初回JS/HTML非圧縮と個別gzip | lazy import後の全JS、実transfer size、hydration時間、入力遅延、CDN |
| T21 | 値だけでなく取得元の回数と操作を記録して再利用を区別する | build中の取得、3 route各GET3回、HITヘッダー、browser戻る/refresh/新規Link | Cache Components有効時、TTL、再検証、分散キャッシュ、認証/POST/AbortSignal |
| T34 | データの巻き戻しと起動候補の選択を区別する | 公式とbyte一致するSwift本体をmacOSで7条件実行、taskログとdelegate呼出 | iOS実機、RN bridge、update DB選択、embeddedの選択、配信、本番復旧、10秒の監視解除実測 |
| O25 | 聞き手に残す判断に沿って持ち時間を配る | 実在する9/10/11枚の資料、構成メモ、Gitの53件再計算、270+30秒の提案 | 実際に使った最終版、登壇の反応、読み上げ時間、AIの生産性向上の定量効果 |

## 一次資料

Plane:

- [料金](https://plane.so/pricing)、[Community](https://plane.so/open-source)、[Commercial最低席数の公式告知](https://forum.plane.so/t/new-seat-minimums-on-self-hosted-commercial-and-air-gapped-starting-april-24/96)。古い比較ブログの最低席数説明は採用しない。
- [backup / restore](https://developers.plane.so/self-hosting/manage/backup-restore)。Commercial Prime CLIとCommunityの手順を区別。
- `makeplane/plane@2f895b82dad839c730c36a5c0cbc046f1e5d6b56`の[Compose](https://github.com/makeplane/plane/blob/2f895b82dad839c730c36a5c0cbc046f1e5d6b56/deployments/cli/community/docker-compose.yml)、[restore.sh](https://github.com/makeplane/plane/blob/2f895b82dad839c730c36a5c0cbc046f1e5d6b56/deployments/cli/community/restore.sh)。previewの固定時点であり、安定版の導入を検証した扱いにしない。[構成記録](plane-compose-inventory.json)にSHAとservice / volume一覧。

React / Next.js:

- [Suspense](https://react.dev/reference/react/Suspense)、[use](https://react.dev/reference/react/use)、[useTransition](https://react.dev/reference/react/useTransition)。未キャッシュPromiseをrenderごとに作る例は使わない。
- [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)、[use client](https://nextjs.org/docs/app/api-reference/directives/use-client)。import依存とchildrenによるServer要素の受け渡しを区別。
- [Caching without Cache Components](https://nextjs.org/docs/app/guides/caching-without-cache-components)、[connection](https://nextjs.org/docs/app/api-reference/functions/connection)、[useRouter](https://nextjs.org/docs/app/api-reference/functions/use-router)。現行caching URLは従来モデルのページへredirectする。cacheComponents=falseの結果へ限定。
- npmで確認したNext現行版16.3.4を実験専用packageへ固定。既存記事プロジェクトや個人アプリの依存は変更しない。React依存19.2.5とは別に、Next同梱React/DOM `19.3.0-canary-cbb046ab-20260731`とwebpackの同梱moduleを確認し日英へ明記。

Expo:

- [error recovery](https://docs.expo.dev/eas-update/error-recovery/)、[Rollbacks](https://docs.expo.dev/eas-update/rollbacks/)、[runtime versions](https://docs.expo.dev/eas-update/runtime-versions/)。端末の復旧候補と配信側のrollback、ネイティブ互換性を分離。
- Voices Diaryの`expo-updates@29.0.18`と、npm gitHead `45c60e10956764bbac6c62454890eeb25c74bbd6`の[ErrorRecovery.swift](https://github.com/expo/expo/blob/45c60e10956764bbac6c62454890eeb25c74bbd6/packages/expo-updates/ios/EXUpdates/ErrorRecovery.swift)がbyte一致。推測したpackage tag URLは404だったため、実際のnpm metadataから固定commitを解決した。
- 公式文書は過去のcontent appearedも現在の表示後とまとめているが、固定ソースでは過去成功のみの場合、新しいupdateを起動する候補は残る。追加の7番目の分岐確認とtaskログで確認し、日英ともこの差を明記。文書の広い説明を特定版の即時再起動の保証として書かない。

LT:

- 個人GitHubディレクトリ直下の`volt-nomad-lightning-talk-draft.pptx`（9枚）、`.codex-tmp/volt-nomad-style-revision/volt-nomad-lightning-talk-revised.pptx`（10枚）、`.codex-tmp/volt-nomad-bio-services/volt-nomad-lightning-talk-portfolio.pptx`（11枚）。本文を直接抽出・照合。[初稿の記録](lt-draft-text.json)、[改訂版の見出し・hash](lt-revision-text.json)。自己紹介の個人情報は必要な範囲へ絞り、記事には転記しない。
- `.codex-tmp/volt-nomad-lt-01a03d13/deck-plan.txt`、`source-notes.txt`の構成と一次資料への指示を読む。補助的に「volt nomad制作LTスライド作成」の既存タスクを参照し、ファイルを探した。そこでの説明を実際の登壇成功の証拠にはしない。
- `game-jam-lab@f074703848586828b6a5acc0e465ccdd2c0d5244`のREADME / DEVLOG_DRAFT / ASSET_PROVENANCE / review-manifestを固定。退役変更は`51984887e2b2be66c1330a3ade8d82a9392532b6`。[検証記録](lt-source-audit.json)。パス指定、JSTの8/1から8/12の範囲で53commitを再計算。数を生産性の測定へ転用しない。
- [公開ゲームページ](https://tsgamestudio.itch.io/volt-nomad)はゲーム構造とAI開示を確認する補助資料。登壇状況とは関係付けない。

## 実験と実行結果

- [run-next-batch07.py](../../../experiments/article-stock-2026-09/run-next-batch07.py)と[専用アプリ](../../../experiments/article-stock-2026-09/next-batch07)。Node24.15.0 / Next16.3.4。`npm install --prefix experiments/article-stock-2026-09/next-batch07 --ignore-scripts --no-audit --no-fund`で専用依存を導入し、runnerをPython3.14.5で実行。runnerはこの実験の`.next`だけを消してbuildし、task専用loopback origin/serverとPlaywright sessionを終了時に閉じる。
- [next-bundle.json](next-bundle.json): broad/leaves/slotのJS 581755 / 558872 / 558817 bytes。HTML 25984 / 58819 / 58617 bytes。gzipは各ファイルをPythonで再圧縮し合算。JSからcatalog markerが消えたこと、全256行一致、ボタン各1回操作を確認。[module表](next-client-modules.json)はvendorを除いた依存情報で、時間の測定ではない。
- [next-cache.json](next-cache.json): buildではfullだけ1回。HTTP GET各3回でorigin追加はmemo3/data1/full0。memoは[1,1]/[2,2]/[3,3]。fullのみx-nextjs-cache HIT。browserは直接/戻る/refresh/新規Linkの順に1/1/2/3。
- [build log](next-build.log)と[server log](next-server.log): 二つのlockfileによるoutput tracing rootの推定警告あり。build・実行は成功。依存の実体と出力を確認した比較であり、警告のない構成と主張しない。初回はPlaywright CLI run-codeに関数ではなく本文を渡して停止したため、CLI helpで形式を確認して修正し、全体を再実行。記事の数字は成功した一回のbuildから取得したもの。
- [run-suspense-batch07.py](../../../experiments/article-stock-2026-09/run-suspense-batch07.py)、[結果](suspense-results.json)。circle-hubの既存React19.2.5/esbuild0.27.4を読み取り専用で使って別の一時ディレクトリへbundle。5条件、手動解決の安定Promise、初回/表示/更新中/解決後。全条件で入力typedを保持。DOM祖先のdisplay:noneを含めて表示を確認。paintの計測はしていない。
- [probe-plane-restore.py](../../../experiments/article-stock-2026-09/probe-plane-restore.py)、[4結果](plane-restore-cli.json)。Python3.14.5、bash、jq。固定restore.shへPATH内だけのDocker/Compose代役を渡す。daemonや実ボリュームへ到達せず、偽アーカイブ名の全件/欠落/volume欠落/復元失敗で分岐を確認。すべてexit0で成功文言、呼び出し数4/3/3/4。失敗率や実データ復元能力の証拠へはしない。
- [probe-expo-error-recovery.py](../../../experiments/article-stock-2026-09/probe-expo-error-recovery.py)、[7結果](expo-error-recovery.json)。Swift6.3.3 / language mode5。公式Swiftファイルは無変更。周辺のReact module/logger/DB/network/relaunchのみ代役。元の5000ms timeoutを実行。最初の5.2s固定sleepでは通知前に判定したため、delegateの通知を待つsemaphoreへ修正した。失敗をSwift preconditionでcrashさせる検証器も、結果を保存してPython側で判定する形へ変更。追加の過去成功・新更新readyとtaskログを含む最終7条件が成功。
- NextとSuspenseのconsoleエラーはfavicon.icoの404だけ。アプリ例外なし。`output/playwright/batch07-*`に記録。Playwright CLI0.1.19 / browser UA152.0.0.0。専用ブラウザは終了済み。
- [掲載コード照合](snippet-verification.json): 6つのJS/JSX/TSXブロックは実行ソースと完全一致。O25の掲載Pythonを直接実行し270+30=300を確認。実験ファイルと記事中のbyte数、分岐結果、Humanizer最終hashも照合。

## 内容の重複と日英の照合

6組とも問題、確認方法、具体例、結果、制約を含む。英語は要約にせず、全節・表・出典・実行コードを保持。P20の実復元なし、T18の初回と更新、T19のJSとHTMLの増減、T21の従来モデルへの限定、T34の公式説明と固定実装の差、O25の提案と登壇実測の区別を読み合わせた。

タイトルの完全重複はなし。4-gramの上位候補を確認し、既存記事の見出しと該当部分も照合した。

- P20は既存のPlane機能分類に対し、Edition/費用に加えて復元CLIの失敗伝達を扱う。再試行という共通語があるCron/Queues記事とは対象が異なる。
- T18はT14の再計算削減や速度測定と分離し、待機中の表示領域と状態を扱う。
- T19は境界モジュールの数とimportグラフを同一画面で比較。T21のHTTP再利用とは実験も結論も異なる。
- T21は4つの呼称の辞書説明だけにせず、同値レスポンスをorigin到達とbrowser操作で分解する。
- T34はO20の旧版Push移行/O19の配布経路/既存EAS手順とは異なり、元のSwift復旧pipelineを実行する。
- O25はO05の判断記録/O09の制作記監査/O17の素材台帳を繰り返さず、実在するLTの導入重複と時間配分を中心にする。数字の節は主題の裏付けに必要な範囲へ留めた。

Humanizer v2.9.1を12ファイルへ適用。[編集計画](humanizer-edits.json)、[監査](humanizer-audit.json)。定型的な主題宣言、曖昧な接続、過剰な締めを短くし、架空の一人称経験を加えない。frontmatter、コードフェンス、URL、順序付き数字トークンが完全に不変。最終ファイル12件のhashも確認。

## 完成ゲート

- `npx zenn list:articles`成功、[一覧](zenn-list.txt)に6件あり。
- [バッチ検証](content-validation.json): 6組すべてcanonical例外なし。必須frontmatter、draft flags、dev.to tags最大4、fence、code/URL対訳、タイトルと内容重複候補、予約未追加。
- [全完成記事の検証](complete-validation.json)は完成・検証済み対象を再検査。
- [repository guard](repository-guard.json): baseline全137ファイルと既存199記事をbyte比較。候補表の進捗部以外のbaseline、公開flags、予約表、workflow、既存本文・IDは維持。
- build/serverログの行末空白とprogress表示のCRを正規化（メッセージは保持）。`git diff --check`とstage後の`git diff --cached --check`。6組単位でcommit、個人アカウントとremote ownerを確認して作業ブランチへpushする。

Qiitaのcanonical未確定3本は引き続き未完成。新規に公開先IDを推測したり、外部へ記事を作って取得したりしない。
