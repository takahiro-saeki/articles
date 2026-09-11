# 第11バッチ: Planeの検索条件と未導入機能の設計を分ける

2026-09-11。P05、P06、P07、P11、P12、P13の日本語Qiita下書きとdev.to英訳を作成した。本文・根拠・日英対訳・Humanizerの確認は済んでいる。Qiitaの将来の記事IDが未確定のため、canonical URLはnull、状態は「執筆中」。外部に記事やPlaneの設定を作成していない。

このバッチ後は完成41/90、本文検証済み68/90、canonical待ち27、本文の検証が残る候補22。canonical未確定の記事を完成数に加えない。

## 記事ごとの答えと証拠

| ID | 答え | 実施した確認 | 限界 |
| --- | --- | --- | --- |
| P05 | ラベル追加前に既存の状態・優先度で探せる範囲を確認する | SquadNoteのラベル一覧0件、Work Item 52件の全labelsが空。状態・優先度を集計し、固定Gitの技術構成と制作資料を読む | ラベルを減らした実体験ではない。kind:bug/contentは提案。検索時間や採用効果は未測定 |
| P06 | 今日のViewと未設定の確認先を分ける | 未完了174、期限が今日以前15、担当者付きの期限集合0、未担当の期限集合15、期限なし56。実データ集計とローカル7境界入力 | View保存はしていない。currentUserはAPI実行者。日付変更時のタイムゾーンは未検証 |
| P07 | 括弧とフィールド名を確認し、状態別に照合してから保存する | 括弧あり121、なし150、増加はCompleted29。INも121。state__groupの条件は拒否、stateGroupへ直すと12 | PQLの全構文の網羅ではない。View・ダッシュボード保存は未実施。未登録の待ち状態を推測しない |
| P11 | 次回の起票と前回の未完了を別々に管理する | 公式の新規インスタンス・将来分への編集という仕様を確認。依存確認の5項目とv1/v2の台帳例を作る | 予定起票の実行0回。台帳は合成例で、Plane実行結果ではない。Business表示を明記 |
| P12 | Intakeの受け入れ判断とProjectの作業状態を分ける | SquadNoteのintakes=false。公式の受付経路と4つのローカル判断例を確認 | 入力・判断・通知・Snoozeの操作なし。却下後の状態について公式2ページが不一致で、実挙動は未確認 |
| P13 | 共通の開始手順とProjectごとの値を分ける | 公式のProject Templateの範囲を確認し、3初期タスクを架空2Projectへ適用する設定案を点検 | Plane Project作成0件。テンプレート一覧は空応答で、登録0件とは判断しない。Business表示を明記 |

## 個人Planeの読み取り

`plane-personal-tickets`スキルを使用し、個人用`plane_personal`コネクターのWorkspace `hiro-work`だけを参照した。Work ItemやProjectの作成・更新・削除、Viewの保存、Intakeの有効化、メッセージ送信はしていない。

Project一覧は5件で次ページなし。Work Itemは非アーカイブのアクセス可能な範囲を100、100、33件の3ページで取得し、総数233・ID重複なし・最終ページで終了を確認した。内訳はDRG 28、RECITAL 118、MEG 28、SQN 52、HIROW 7。本文には必要な集計を載せ、全タイトルや説明文は取得用のfieldから除いた。

- [plane-read-results.json](plane-read-results.json): 読み取り17クエリ、ページ情報、集計に必要な正規化233行、SquadNoteのラベルとfeature flags、ツールの制約。
- [plane-analysis.json](plane-analysis.json): Python 3.14.5の独立した条件式による再集計、優先度別のAND/ORの差、7つのローカル境界入力。
- [snippet-verification.json](snippet-verification.json): 掲載10 PQLブロックが実行した式と完全一致し、英訳でも同じことを確認。誤フィールドの例は期待した拒否として区別。

`currentUser()`の件数は認証された呼出元の結果として記録した。保存データのassigneeCountからユーザーの個人情報を推測していない。期限集合に割当済みの行がないことは、取得した全行から独立に確認できる。

PQLリファレンス専用ツールは、actionなしで「readが必要」、actionを渡すと引数検証エラーになった。そこで現行公式ページを読み、実行後は誤フィールドの応答が返したAPI側リファレンスも確認した。一般UIの全機能とコネクターの対応範囲を同一視していない。テンプレート一覧はcontentが空であり、「テンプレート0件」という有効な一覧応答とは扱わない。

## 一次資料と設計案

2026-09-11に以下の公式ページの本文を確認した。

- [Work Item Labels](https://docs.plane.so/core-concepts/issues/labels): Project単位の分類、既存プロパティとの役割、ラベルと親子削除の影響。
- [Work Item Properties](https://docs.plane.so/core-concepts/issues/properties): 状態・優先度・担当・期限の意味。
- [Views](https://docs.plane.so/core-concepts/views): Project/Workspaceの範囲、Workspaceのspreadsheet表示、作成・更新の保存手順。
- [PQL](https://docs.plane.so/core-concepts/issues/plane-query-language): Pro表示、stateGroup、openStates、currentUser、日付・NULL、論理条件、保存先。
- [Recurring Work Items](https://docs.plane.so/core-concepts/projects/recurring-work-items): Business表示、新しい一回の作成、予定、編集が将来分へ影響する範囲。
- [Intake Overview](https://docs.plane.so/intake/overview)と[In-app](https://docs.plane.so/core-concepts/intake): Projectの有効化、Guestの手順、Triage、受け入れ・再確認・却下・重複。Overviewの「却下・重複もTriage」とIn-appの「Cancelledへ入る」が一致しないため、記事へ不一致を記載。
- [Project Templates](https://docs.plane.so/templates/project-templates)と[Work Item Templates](https://docs.plane.so/templates/work-item-templates): Business/Pro表示、Project全体と一作業の再利用範囲、初期作業、作成時の調整。

P05の準備Aは、circle-hubのGitオブジェクトから3ファイルを確認した。[repository-sources.json](repository-sources.json)にSHA、固定commit、path、履歴を収録している。`docs/architecture.md`は固定した旧文書であり、現在の依存versionを示す資料には使わない。InstagramのREADMEとindex.htmlは後続commit `e295f5c`で確認し、初期制作`560e752`から後続資料への更新を辿った。作業ツリーの未コミット文書を固定commitの内容と混同していない。

[proposed-configurations.json](proposed-configurations.json)には、依存確認の説明欄、前回未完了の合成台帳、4つのIntake判断例、3つのProject初期タスクと架空2Projectへの適用を保存した。これは人が設定を検討するための資料で、Plane APIのリクエスト形式ではない。ローカル例をPlaneの実動作の証明としては使わない。

## 再検証

```sh
python3 experiments/article-stock-2026-09/analyze-plane-batch11.py
python3 experiments/article-stock-2026-09/verify-batch11-article-evidence.py
node scripts/validate-article-stock.mjs --batch=11 --allow-pending-canonical
npx zenn list:articles
git diff --check
```

分析コードは保存済みの取得値を読み、ネットワークへアクセスしない。Git資料の照合にはローカルのcircle-hubと記載の固定commitが必要。クエリのlive再実行は別作業であり、後日同じ件数になるとは限らない。

## 重複・対訳・Humanizer

既存のPlane Project境界、Pages/Work Item、Estimate、Codex TODO集約の記事を読み比べた。P05は分類と検索の軸、P06は担当・期限の欠落、P07は論理式と集計項目に絞る。P11の周期的な作業作成とP13のProject開始時の初期化も分ける。既存の投稿自動化の記事にある実際の公開処理を、Planeの定期起票の機能として再説明していない。

P06/P07は一部のデータと日付フィルターを共有するが、主要な答えは未設定による欠落とAND/ORによる混入で異なる。類似度の近接候補もこの違いで確認した。原案の「残した分類」「使っているテンプレート」など、確認できない過去の運用はタイトルから変更した。

日英は全節、表、クエリ、結果、提案と未実施範囲を照合した。英訳の省略や架空の一人称体験は入れていない。Humanizerスキルv2.9.1のdraft→audit→finalを12原稿に適用し、24箇所を推敲した。強い対比、長い否定、定型的な締めを整理している。

- [humanizer-edits.json](humanizer-edits.json)、[humanizer-audit.json](humanizer-audit.json): 手動の推敲、意味の確認、frontmatter・fence・数値・URL不変と最終SHA。
- [content-validation.json](content-validation.json): 6組の本文用ゲート。canonical未確定だけを明示的に除外。
- [canonical-gate.json](canonical-gate.json): 例外なしの完成ゲートはcanonicalの未解決で期待どおり失敗。
- [complete-validation.json](complete-validation.json): 既存完成41組を例外なしで検証。
- [zenn-list.txt](zenn-list.txt): `npx zenn list:articles` exit 0。今回の新規日本語記事はQiita用。
- [repository-guard.json](repository-guard.json): 制作開始前137ファイルと、このバッチ直前247記事ファイルのbyte一致。アイデア表の元の候補内容も保持。

`git diff --check`とstage後の`git diff --cached --check`を通過。公開済み記事、予約表、workflowを変更せず、今回の全原稿の公開抑止を維持した。
