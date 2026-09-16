---
title: "D1の複合インデックスを逆順にすると何が変わるか、検索計画で比べた"
tags:
  - Cloudflare
  - D1
  - SQLite
  - SQL
private: false
updated_at: '2026-09-16T10:54:42+09:00'
id: 0ed80ed871c972ead808
organization_url_name: null
slide: false
ignorePublish: false
---

`WHERE user_id = ? AND created_at >= ?`で通知を検索する場合、`(user_id, created_at)`と`(created_at, user_id)`は同じ働きにはなりません。

ローカルD1で比較すると、前者の検索計画にはユーザーと作成時刻の両方が探索条件として現れ、後者には作成時刻だけが現れました。調べたのは、インデックスのどの範囲を探す計画になるかです。レスポンスタイムは測っていません。

## 比較するクエリを先に固定する

SquadNoteの通知テーブルにあるユーザーと作成時刻を題材に、必要な列だけのテーブルを作りました。運用中のDBやインデックスを変更した実験ではありません。

```sql
CREATE TABLE notification (
  id INTEGER PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
```

日時は連続する整数で代用します。1から10,000までの行を作り、ユーザーを100種類に振り分けます。

```sql
WITH RECURSIVE seq(n) AS (
  SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 10000
)
INSERT INTO notification(id,user_id,created_at)
SELECT n, 'user-' || (n % 100), n FROM seq;
```

比較対象のSELECTは変えません。

```sql
SELECT id FROM notification
WHERE user_id = 'user-42' AND created_at >= 9000
ORDER BY created_at DESC;
```

`user_id`は等価条件、`created_at`は範囲条件と並び順です。どちらの列が一般に重要かを決めるのではなく、このクエリに対する列順を比べます。

## WranglerのローカルDBで実行する

検証日は2026年9月11日、Node.js `v24.15.0`、Wrangler `4.81.1`です。[再現用のSQLと設定](https://github.com/takahiro-saeki/articles/tree/codex/article-stock-2026-09/experiments/article-stock-2026-09/d1-index)を使います。

```bash
npx wrangler@4.81.1 d1 execute article-index-lab --local \
  --config experiments/article-stock-2026-09/d1-index/wrangler.jsonc \
  --file experiments/article-stock-2026-09/d1-index/compare.sql \
  --persist-to /tmp/article-stock-d1-index-lab --json
```

再現SQLは実験用テーブルを作り直します。`--local`と専用の保存先を指定し、本番DBへ接続しない構成です。設定内のDB IDもローカル実験用のダミー値です。[公式CLIリファレンス](https://developers.cloudflare.com/d1/wrangler-commands/#execute)に、`--local`と`--persist-to`の役割が記載されています。

SQLite内部のバージョンを調べるために`sqlite_version()`も試しましたが、この環境では関数の利用を拒否されました。内部版の値は取得できていません。

## indexなし、等価条件が先、範囲条件が先を比べる

SELECTの前に`EXPLAIN QUERY PLAN`を付け、インデックスを一つずつ入れ替えました。

```sql
CREATE INDEX idx_user_created ON notification(user_id, created_at);
```

逆順の場合はこの定義です。同時に両方を置いた比較ではありません。

```sql
CREATE INDEX idx_created_user ON notification(created_at, user_id);
```

結果の`detail`は次のようになりました。

```text
indexなし:
SCAN notification
USE TEMP B-TREE FOR ORDER BY

(user_id, created_at):
SEARCH notification USING COVERING INDEX idx_user_created (user_id=? AND created_at>?)

(created_at, user_id):
SEARCH notification USING COVERING INDEX idx_created_user (created_at>?)
```

インデックスなしでは全体を走査し、並べ替えにも一時的なB-treeを使う計画です。`(user_id, created_at)`はユーザーを絞った範囲内で時刻を探索します。逆順では時刻の範囲から探し、ユーザーの条件を残りの絞り込みとして扱います。

計画の表示は`created_at>?`ですが、実行したSQLはどちらも`created_at >= 9000`です。実際に返るIDも検証しています。

[SQLiteのQuery Planning](https://sqlite.org/queryplanner.html)では、複合インデックスが左側の列から並ぶ仕組みを説明しています。今回の差は、先頭列を等価条件で固定してから、その中の時刻範囲へ進めるかどうかで読むと理解できます。

## COVERINGだけで列順の良し悪しを決めない

今回の二つの計画は、どちらも`COVERING INDEX`でした。取得するのは`id`だけで、このテーブルの`INTEGER PRIMARY KEY`はrowidの別名です。必要な値をインデックスから取り出せる構成でも、探索する範囲が同じとは限りません。

したがって「COVERINGになったから、逆順でも同じ」とは判断できません。`SEARCH`の括弧の中に、どの条件が現れているかも読みます。

[Cloudflareのインデックスの説明](https://developers.cloudflare.com/d1/best-practices/use-indexes/)も、クエリに合わせたインデックスを確認する入口になります。ただし、今回は本番の読取り行数や課金への影響を計測していません。

## 返る行が同じことも確認する

両方のインデックスで10行が返り、IDの合計は94,920でした。さらに次のID列が同じ順序になることをassertで確認しました。

```text
9942, 9842, 9742, 9642, 9542, 9442, 9342, 9242, 9142, 9042
```

検索計画を改善するつもりで、SELECTまで変更していないかを確認するためです。行数と合計だけでは異なる集合が一致する場合があるため、今回の小さな結果ではID列そのものも比べています。

このデータは均等に作った実験用の分布です。特定ユーザーに通知が偏る場合や、時刻だけを検索するクエリでは、同じ判断をそのまま適用できません。書込み時のインデックス更新コストも比較していません。

今回のクエリには、等価条件の`user_id`を先に置く列順が、両方の条件を探索へ使う計画を作りました。別のクエリを検討するときも、列名だけで決めず、SELECTと検索計画と返る行を一組で比べます。
