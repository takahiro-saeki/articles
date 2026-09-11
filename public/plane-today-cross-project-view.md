---
title: "Planeの横断Viewが0件でも、今日の作業がないとは限らない"
tags:
  - Plane
  - タスク管理
  - 個人開発
private: false
updated_at: null
id: null
organization_url_name: null
slide: false
ignorePublish: true
---

「自分が担当し、今日までが期限の未完了」を検索すると0件でした。担当者の条件を外すと15件あり、その15件はすべて担当者未設定でした。

複数ProjectをまとめるViewは、元データに担当者や期限が入っている範囲しか拾えません。「今日見る作業」と「条件から落ちた作業」を別々に確認する構成にします。

## Projectの内側ではなくWorkspaceから見る

[Viewsの公式説明](https://docs.plane.so/core-concepts/views)では、Project ViewはそのProject、Workspace ViewはProjectをまたぐ範囲を扱います。今回の目的は後者です。Workspace側のViewsから、対象の条件を設定する流れを使います。

公式資料では、Workspace Viewの表示はspreadsheet layoutと説明されています。Project Viewの全レイアウト対応を、そのまま横断Viewへ当てはめません。

この記事ではViewを作成・保存していません。保存前に必要な条件を確かめるため、個人Workspaceの読み取りAPIでPQLを実行し、返ったWork Itemの値と照合しました。

## 「今日まで」を期限の条件として定義する

基準日は2026年9月11日です。「今日まで」は期限が今日以前で、状態がBacklog、Unstarted、Startedのものとしました。今日から着手したい作業、開始日が今日の作業、今日中に終えられる量とは区別します。

実行した条件は次です。

```pql
assignee = currentUser() AND stateGroup IN (openStates()) AND dueDate <= today()
```

currentUserは、このクエリを実行する認証ユーザーです。別の人が同じ条件を使うと担当者の意味が変わります。[PQLの公式資料](https://docs.plane.so/core-concepts/issues/plane-query-language)で、currentUser、openStates、日付比較の定義を確認しました。

取得した非アーカイブのWork Itemは5 Projectの233件です。100件、100件、33件の3ページを取得し、最後に次ページがないことと、IDが重複していないことを確認しています。

| 確認した範囲 | 件数 |
| --- | ---: |
| 未完了全体 | 174 |
| そのうち実行ユーザーへ割当済み | 6 |
| 今日以前が期限の未完了全体 | 15 |
| 今日以前が期限で、実行ユーザーへ割当済み | 0 |
| 今日以前が期限で、担当者未設定 | 15 |

Pythonで取得値へ同じ条件を当てても、期限の集合に担当者付きの行はありませんでした。空の結果は保存値と一致しています。

## 未設定を拾う入口を隣に置く

担当者未設定の確認用には、次の条件を実行しました。

```pql
stateGroup IN (openStates()) AND dueDate <= today() AND hasNoAssignee()
```

これが15件を返しました。個人Projectだからすべて自分の作業だと思っていても、assigneeフィールドが自動的に埋まるとは限りません。

期限未設定は、別の条件にします。

```pql
stateGroup IN (openStates()) AND dueDate IS NULL
```

結果は56件でした。期限がないため、今日以前という比較からは落ちます。この56件を表示させるために、期限へ今日の日付を一括設定することは避けます。[Due dateの定義](https://docs.plane.so/core-concepts/issues/properties)は終了予定日であり、一覧に載せるための印とは意味が違います。

保存するなら「自分の期限確認」「期限あり・担当者未設定」「期限未設定の棚卸し」の3つを候補にします。未設定の一覧は今日の実行計画そのものではありません。必要な担当・期限を判断する入口です。

## 予定表として使う前に、境界の入力を確認する

ローカルの集計関数には、前日、当日、翌日、期限なし、完了、キャンセル、担当者なしの7入力も渡しました。未完了は5件、当日までの期限付きは3件、その中の担当者なしは1件でした。

これはPython側の照合関数のテストです。Planeにテスト用チケットを作ったり、UIの保存や時刻境界を試したりしたわけではありません。実際のPQLの件数とは、233件の取得値を使って別途照合しています。

日付が変わる瞬間のタイムゾーン差は検証していません。再現用には`today()`だけでなく、基準日を文字列で指定した検索も行い、この日の15件と一致することを確認しました。将来同じ件数になることを期待するテストではありません。

## Viewの結果から、そのまま着手量を決めない

15件を拾えたことは、15件を今日中に処理できるという意味ではありません。期限の過ぎた作業には、期限の見直し、外部待ち、作業の取り下げなど別の判断もあり得ます。この調査では、それぞれの予定を変更していません。

Viewを保存するときは、対象Project、未完了の定義、担当者、期限、表示する列を確認します。条件の変更後に保存が必要であることも、公式手順に沿って確認する対象です。今回はPQLの取得結果までが検証済みで、View保存後の再表示は未実施です。

検証日は2026年9月11日、Planeの個人Workspaceへの読み取りとPython 3.14.5で行いました。[取得結果](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/production/2026-09/batch-11/plane-read-results.json)と[集計コード](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/analyze-plane-batch11.py)を保存しています。公開版の資料ではPQLにProの表示があります。利用環境で使えるフィルターと権限は、保存前に確認してください。
