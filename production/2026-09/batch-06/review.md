# Batch 06: Planeの運用判断と、比較実験による保守の棚卸し

確認日: 2026-09-11。P08/P10/P17/P19/T14/O19のZenn向け日英6組。完成時点で35/90件、残り55件。優先12本のうち9件完成。T01/T31/T37はQiitaの将来URLが未確定で、本文はあるが完成に含めない。

## 記事ごとの答えと検証範囲

| ID | 読者が持ち帰る答え | 確認したこと | 確認していないこと |
| --- | --- | --- | --- |
| P08 | 週の終了、Devの受け入れ、配布の完了を別に判断する | Plane SQN-30の対象範囲とIn Progress、Cycle/Module各0件。固定Git文書のWeb確認済み・モバイル未完了。3時点の運用案を照合 | 実Cycle移動、Module作成、2週間の運用効果、今回の実機操作 |
| P10 | 全プロダクトを束ねる前に、共通の完了条件と管理先を決める | 全5Project、専用Initiatives無効。SquadNote/Voices Diaryの通知の対象と実装差 | 専用機能のUI・集計式、管理先不明のProject作成、実通知、効率向上 |
| P17 | 同じテーマのTODOを成果物・親子・対象版で照合する | SQN-14/27の親子、46/47/48の親・静止画・動画、説明欄の出典日付、Gitの制作履歴と後続公開準備 | 会話全文の自動抽出、重複チケットの削除/統合、公開完了の判定 |
| P19 | ポイントは作業の偏りを読む材料にする。欠損と重複を先に確認する | 非アーカイブ52件、未完了22件148pt、In Progress6件すべて8pt。同じ3件の11/24pt比較。ローカル入力の欠損・0・尺度外・重複で4拒否 | 期間のthroughput、工数換算、親子の独立残作業量、現在値から過去の週を復元すること |
| T14 | メモ化の採否は省ける再計算と更新コストで判断する | 実formatter、React production/Compilerなしで9ケース×9round。各20warmup後100同期更新。計算回数と全DOM文字列の一致 | paint、ユーザー入力からの遅延、実ユーザー規模、コピー実操作、Compiler有効時、スマホ性能 |
| O19 | 2サービスの保守を配布経路と確認先で棚卸しする | 固定20資料のhash、preview internal/store差・本番API、appVersion/fingerprint差、通知と認証の変更 | 現在のストア版、配信済みのOTA、実機OAuth/通知、保守時間の増加率 |

## 一次資料

個人Planeは読み取りのみ。`hiro-work`のProject一覧は全5件で次ページなし。SquadNote非アーカイブWork Itemは全52件で次ページなし。見積りはWork Pointsの有効な値を取得してIDから数値へ対応付けた。最初の`expand=state,estimate_point`はconnectorのestimate_point型検証エラーになり、展開をstateだけに変更して取得できた。エラー応答から件数・値を補っていない。

- [plane-snapshot.json](plane-snapshot.json): 必要なID表記、タイトル、状態グループ、point、priorityだけを保持。Project一覧と機能の確認も記録。
- [plane-ticket-evidence.json](plane-ticket-evidence.json): 6件の説明とparentを読んだ後の要点。検証用招待URL、個人のアカウントID、Notionの元URLなどは証跡へ転記しない。
- [repository-evidence.json](repository-evidence.json): 固定Gitソース20件。SquadNote `d116e8a343e8d9e7ddd3d1985efe590fa1901868`、Voices Diary `6143bb99873ccf04b134dad4ac6b12c6e7a02d48`、Instagram作業 `e295f5cedf9f8989b36c9f308dee4dbd8cf64c3f`。
- T14のみ別の固定履歴`770de5f2989775cfd95f7a9c4529565a2b48d2fd`から`format-monthly-summary.ts`と呼出元を確認。これは本番最新版という指定ではない。formatterは変更せず、一時ディレクトリへ取り出した。
- P17の制作履歴`560e752`、`afcf45f`、`e295f5c`を読む。SQN-48のDoneと後続の公開準備文書を区別し、誤って閉じたとは断定しない。
- O19ではVoices DiaryのREADMEの未着手説明を、同コミットのアプリ実装へ照合。`6143bb9`の認証後待機とURL scheme設定の差分も確認。古いランブックの料金・所要時間・配布済み状態は記事の現在値に使わない。

外部公式資料を現在のページで確認:

- [Plane Cycles](https://docs.plane.so/core-concepts/cycles): 終了と未完了の状態、移動、一件の所属Cycle。
- [Plane Modules](https://docs.plane.so/core-concepts/modules): 一件を機能とリリースへ関連付ける機能。
- [Plane Initiatives](https://docs.plane.so/core-concepts/projects/initiatives): 共通目的、ScopeのProject/Work Item、有効化とPro表記。
- [Plane Estimates](https://docs.plane.so/core-concepts/issues/estimates): 尺度の種類。個人のWork Pointsの意味は実Projectとローカル運用ルールから確認。
- [React useMemo](https://react.dev/reference/react/useMemo)、[useCallback](https://react.dev/reference/react/useCallback): 依存の比較、初回と再更新、関数の定義と呼出結果、本番計測、Compilerの扱い。
- [Expo runtime versions](https://docs.expo.dev/eas-update/runtime-versions/): nativeとの互換性。JS動作やAPI契約まで保証するとは書かない。

## 実験と再現

```bash
python3 experiments/article-stock-2026-09/batch06-repository-evidence.py
python3 experiments/article-stock-2026-09/plane-estimate-audit.py
python3 experiments/article-stock-2026-09/run-react-memo-bench.py
python3 experiments/article-stock-2026-09/verify-batch06-article-evidence.py
```

関連個人リポジトリが同階層にあり、circle-hub/apps/webからReact/React DOM 19.2.5とesbuild0.27.4を解決できる前提。実験は他repoのワークツリーを変更しない。Playwrightはローカルの新規sessionから127.0.0.1の実験ページだけへアクセスし、終了後に閉じた。認証・通知・公開・配布・有料生成は実行していない。

[estimate-audit.json](estimate-audit.json)はPython3.14.5。欠損を0に変換せず、重複IDも拒否する。親子の範囲が重複する問題はID重複とは別で、自動的に解決したことにはしない。完了/キャンセルの欠損13件は未完了集計から除外。進行中のポイントを残り日数へ換算しない。

ReactはNode24.15.0、Playwright CLI0.1.19、HeadlessChrome152.0.0.0（UA表記）、Apple M4 Max/macOS26.6.2。production build、Compilerなし、CPU throttleなし。環境は[react-environment.json](react-environment.json)に記録。

- [react-cheap.json](react-cheap.json): 2,000要素×100更新、direct200,000回計算とmemo0回。中央値29.7/34.5ms、範囲29.1〜33.4/32.9〜39.5ms。中央値の差は4.8msで、一回のHookコストではない。範囲は一部重なる。
- [react-summary.json](react-summary.json): 実formatterへ合成1,000日程。direct48.9ms/100回、安定memo0.1ms/0回、新しいoptions依存49.5ms/100回。
- [react-callback.json](react-callback.json): memo child+inline49.4ms/100回、memo child+安定callback0.0ms/0回、通常child+callback49.1ms/100回、memo child+callback+新しい別prop49.1ms/100回。0.0を無時間や無限倍率と扱わない。
- 初回はcheap出力の先頭と長さのみを比較していたため、全DOM文字列の一致へ強化して計測し直した。[react-first-run](react-first-run/)は初回の記録。本文は再計測の9roundだけを使用し、都合のよい結果を混ぜない。再測定で範囲が重なったため本文の判断も修正した。
- ブラウザconsoleのエラーはfavicon.icoの404のみ。実験コードの例外なし。Playwright snapshotとconsoleは`output/playwright/batch06`に保持。

## 内容、英訳、Humanizer

全6組で問題・確認方法・具体例・結果・制約を読み合わせた。英語を要約にはせず、全節と表を保持。P08の仮の週次推移、P10の導入案、P17の出典日付と範囲、P19の実データとローカル異常入力、T14の計測値と初回除外、O19の固定設定と未確認の配布状況が対応している。

重複判定は自動類似度の上位候補を読み、論点を比較:

- P08はP03の用語選択とP14の文書配置から、週締めの持ち越しとDev/配布の別完了へ進めた。
- P10はP03のInitiative紹介から、管理先未確定、共通条件、通知目的に含める対象、Project全体の進捗率を誤用しない判断へ絞った。
- P17はP15のGitHub連携とは異なり、実チケットの静止画/動画と親子、Done後の追加準備を照合する。
- P19は既存のPlane紹介にない、52件の集計と同件数比較、欠損・尺度・ID重複の拒否を追加。
- T14はReactの一般解説やAIコードレビューと異なり、実formatterを使ったproduction比較を中心にする。
- O19はEAS/TestFlightの既存手順を繰り返さず、2アプリ間の設定差、古いREADME、通知の対象差を棚卸しする。

Humanizer v2.9.1を12ファイルへ適用。[編集計画](humanizer-edits.json)と[監査](humanizer-audit.json)。一人称の実験体験、仮定が体験に読める冒頭、抽象的な締め、curly quotesを修正。初回の監査が日付と件数の並べ替えで停止したため、未書込の文を数字の順序も維持する形へ修正し、部分適用を戻してから全件再実行。React再計測後も事実更新を先に済ませ、Humanizerの前後でfrontmatter・コード・URL・数字が不変であることを再確認した。

## 最終ゲート

- `npx zenn list:articles`成功、[一覧](zenn-list.txt)に6件あり。
- バッチ6の検証は[content-validation.json](content-validation.json)、完成対象35組は[complete-validation.json](complete-validation.json)。canonical例外なし。
- [snippet-verification.json](snippet-verification.json): 掲載Python/TSXの6ブロックが実行ソースへ一致、9ケースの値と全DOM出力の一致、見積り集計、12ファイルの最終Humanizer hashを確認。
- [repository-guard.json](repository-guard.json): 進捗反映する候補表を除くbaseline全ファイルと、前バッチまでの189記事がbyte同一。
- 検証器はTODOという記事の題材を未記入と誤判定していたため、未記入マーカーの検出へ限定。4種類の未記入を拒否し、3種類の正当な用語使用を受理することを確認。
- `git diff --check`、stage後の`git diff --cached --check`。公開フラグ、予約表、既存workflow、既存記事の本文とIDは変更なし。
