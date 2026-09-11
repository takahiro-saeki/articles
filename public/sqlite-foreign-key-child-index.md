---
title: "SQLiteの外部キーだけでは子のindexはできない。親削除の検索計画で確認する"
tags:
  - SQLite
  - SQL
  - データベース
private: false
updated_at: null
id: null
organization_url_name: null
slide: false
ignorePublish: true
---

SQLiteで`REFERENCES parent(id)`を書いても、子テーブルの参照列にindexは自動作成されませんでした。参照整合性の検査は動きますが、親を削除するときの子の検索はSCANになりました。

外部キー制約があるかと、参照する子をどのように探すかは、別々に確認します。SQLite 3.53.1でindex一覧と実際のDELETEの検索計画を比較しました。

## 外部キーを有効にして、index一覧を見る

Pythonのsqlite3から、メモリ上のデータベースを条件ごとに作りました。接続はautocommitを有効にし、トランザクションの外でforeign_keysをONにしています。

```sql
PRAGMA foreign_keys = ON;
CREATE TABLE parent (id INTEGER PRIMARY KEY);
CREATE TABLE child (
  id INTEGER PRIMARY KEY,
  parent_id INTEGER NOT NULL REFERENCES parent(id)
);
```

親は101件、子は10000件です。子のparent_idは1から100へ均等に割り当て、親101には子を付けません。親1を参照する子は100件になります。

```sql
PRAGMA foreign_keys;
PRAGMA index_list(parent);
PRAGMA index_list(child);
```

外部キーだけの条件では、foreign_keysは`1`、parentとchildのindex一覧は両方とも空でした。それでも、存在しない親999を参照するINSERTと、参照されている親1のDELETEは、どちらも`FOREIGN KEY constraint failed`で失敗します。

indexがないから制約が無効、ということではありません。また、親の`INTEGER PRIMARY KEY`にはrowidによる検索経路があります。index一覧が空であることを、その検索経路もないという意味に広げません。

## 親の削除でも子を探している

同じデータで次の2つの検索計画を取得しました。

```sql
EXPLAIN QUERY PLAN SELECT rowid FROM child WHERE parent_id = 1;
EXPLAIN QUERY PLAN DELETE FROM parent WHERE id = 101;
```

後者は、子を持たない親101を削除する文です。削除できるか判断するため、参照している子がいないことも確認します。

| 文 | 外部キーだけの条件で表示されたchild側の処理 |
| --- | --- |
| SELECT rowid FROM child WHERE parent_id = 1 | SCAN child |
| DELETE FROM parent WHERE id = 101 | SCAN child |

DELETEの計画には、これとは別に`SEARCH parent USING INTEGER PRIMARY KEY (rowid=?)`もありました。親を主キーで探せても、子の参照列を探す経路まで自動で揃うわけではありません。

[SQLiteの外部キー資料](https://sqlite.org/foreignkeys.html#fk_indexes)は、親を削除するときに子の参照列を検索することと、子側indexは必須ではないが有用であることを説明しています。今回のDELETE計画でも、その子側の処理を確認できました。

## 子側へ明示的にindexを追加する

比較用の別データベースには、同じスキーマとデータに加えて次のindexを作りました。

```sql
CREATE INDEX child_parent_idx ON child(parent_id);
```

| 確認項目 | 外部キーだけ | 子側indexあり |
| --- | --- | --- |
| childのindex数 | 0 | 1 |
| 子のSELECT | SCAN child | SEARCH child USING COVERING INDEX child_parent_idx (parent_id=?) |
| 親DELETE内の子の検索 | SCAN child | SEARCH child USING COVERING INDEX child_parent_idx (parent_id=?) |
| 参照中の親1をDELETE | 制約違反 | 制約違反 |
| 存在しない親へのINSERT | 制約違反 | 制約違反 |
| 子のない親101をDELETE | 成功 | 成功 |

indexの追加で変わったのは、子を探す検索計画です。許されるINSERTやDELETEの結果は変わりませんでした。

この比較では処理時間を測っていません。`SCAN`から`SEARCH`へ変わったことだけで、何倍速くなったかは書けません。書き込み時のindex維持コストや実データでの選択度も、採用時には別途確認する対象です。

## 親の自動indexと混同しない

別の条件で、親を`code TEXT UNIQUE`、子を`code TEXT REFERENCES parent(code)`にすると、親には`sqlite_autoindex_parent_1`が現れました。index一覧のoriginは`u`で、子の一覧は空のままです。親のUNIQUE制約に由来するindexを、子の外部キー用indexと読み違えないようにします。

さらに、子側indexを作ったままforeign_keysをOFFにした条件では、存在しない親を参照する行をINSERTできました。`PRAGMA foreign_key_check`はその1件を検出しています。index一覧とは別に、その接続のforeign_keys設定を確認します。

検証は2026年9月11日、Python 3.14.5、SQLite 3.53.1、メモリDB、合成データで行いました。[再現コード](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/sqlite-foreign-key-child-index.py)と[4条件の結果](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/production/2026-09/batch-10/sqlite-results.json)を保存しています。D1のリモートDBやORMによるmigrationは実行していません。

[EXPLAIN QUERY PLANの公式説明](https://sqlite.org/eqp.html)では出力形式がversion間で変わり得ることも明記されています。ここに載せた文字列は今回のversionの記録です。別の環境で確認するときは、制約の有効状態、childのindex一覧、対象DELETEの計画を一緒に見ます。
