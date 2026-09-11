---
title: "PlaneのPQLは括弧で結果が変わる。121件と150件を状態別に照合する"
tags:
  - Plane
  - タスク管理
  - テスト
private: false
updated_at: null
id: null
organization_url_name: null
slide: false
ignorePublish: true
---

未完了のHighまたはUrgentを探すつもりでも、ANDとORの組み合わせによって完了済みが入ります。個人Workspaceで実行すると、括弧を付けた式は121件、付けない式は150件でした。増えた29件はCompletedです。

PQLをViewへ保存する前に、件数と状態の内訳を照合します。ここでは実データへの読み取りクエリと、取得した行に対する別計算を使って違いを確認しました。

## 欲しい集合を先に一文で決める

探したいのは「未完了で、優先度がUrgentかHighの作業」です。未完了の定義は、Backlog、Unstarted、Startedの3グループとしました。

次の条件を実行します。

```pql
stateGroup IN (openStates()) AND (priority = "urgent" OR priority = "high")
```

括弧の中が優先度の選択です。その集合へ、未完了の条件が共通に掛かります。[PQLの公式資料](https://docs.plane.so/core-concepts/issues/plane-query-language)で、論理演算、stateGroup、openStatesの定義を確認しています。

比較用に、括弧を取り去った次の式も実行しました。

```pql
stateGroup IN (openStates()) AND priority = "urgent" OR priority = "high"
```

今回の処理ではANDがORより先に評価され、「未完了かつUrgent」または「High」になりました。後半のHighには未完了の条件が掛かりません。

## 差分は状態別の件数に現れた

2026年9月11日、個人Workspaceのアクセス可能な非アーカイブ233件を対象にしました。最後のページまで取得し、IDの重複がないことも確認しました。

| 状態グループ | 括弧あり | 括弧なし |
| --- | ---: | ---: |
| Backlog | 106 | 106 |
| Unstarted | 6 | 6 |
| Started | 9 | 9 |
| Completed | 0 | 29 |
| 合計 | 121 | 150 |

件数APIの状態別集計だけでなく、取得した行をPythonで分類しても同じ内訳になりました。結果に入ってはいけない状態がないかを確認しています。

今回のデータでは、括弧なしでも未完了の3行は同じです。総数だけを眺めると、Highの完了済みが混ざったことを見落としやすくなります。

同じフィールドの候補をまとめるなら、次の形も使えます。

```pql
stateGroup IN (openStates()) AND priority IN ("urgent", "high")
```

この式も121件でした。今回のように優先度の候補だけを列挙する場合は、選択肢の範囲を短く書けます。異なるフィールドを組み合わせるORまで、すべてINへ置き換える話ではありません。

## 期限超過と、期限なしを同じ一覧へ混ぜない

確認用の入口として、次の2式も実行しました。

```pql
isOverdue()
```

```pql
stateGroup IN (openStates()) AND dueDate IS NULL
```

結果はそれぞれ15件と56件でした。期限超過は期限を持つ未完了、後者は期限そのものがない未完了です。56件を期限超過へ足し込むと、異なる状態を同じ数字で表すことになります。

「確認待ち」「公開待ち」の入口も作れますが、その名前に相当する状態やラベルが存在することが前提です。今回のStartedをすべて確認待ちと読み替えたり、存在しないラベル名をクエリへ埋めたりはしていません。待ち理由を本文にしか残していない作業は、検索条件だけでは正確に拾えません。

## 集計用のフィールド名をPQLへ持ち込まない

読み取りAPIの状態別集計では`group_by`に`state__group`を使いました。同じ綴りをPQLの条件に使うと、次は失敗します。

```pql
state__group = "started"
```

実際の応答は`Filtering on field 'state__group' is not allowed`でした。PQL側は次の名前です。

```pql
stateGroup = "started"
```

修正後は12件を返しました。この違いは、今回使用したAPIの集計パラメーターとPQLの境界です。UIに出る名前、APIのレスポンス名、検索言語のフィールド名が常に一致するとは限りません。

## 期待した集合と照合してから保存する

まず一つの条件で既知のWork Itemが入るかを見て、条件を増やした後に除外したい状態が残っていないかを確認します。ORを足した箇所は、括弧の範囲を再確認します。最後に、期限や担当者の未設定が別の入口で見えるかを調べます。

[Viewの公式手順](https://docs.plane.so/core-concepts/views)に沿って保存するのは、その後です。今回は検索と集計までを実施し、Viewの作成、共有、ダッシュボードへの保存は行っていません。公式資料ではPQLにProの表示があり、使えるフィールドは有効な機能にも依存します。

[17回のクエリの記録](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/production/2026-09/batch-11/plane-read-results.json)と[独立した集計コード](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/analyze-plane-batch11.py)を保存しました。検証は2026年9月11日のPlane読み取りAPIとPython 3.14.5です。返る件数は今後変わりますが、括弧の内外でどの集合を作るかは、保存前に確認できます。
