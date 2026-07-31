---
title: Cloudflare D1にBEGIN TRANSACTIONは無い。実際に叩いて確かめる制約と、batch()での書き方
tags:
  - cloudflare
  - D1
  - SQLite
  - CloudflareWorkers
  - Database
private: false
updated_at: ''
id: null
organization_url_name: null
slide: false
ignorePublish: true
posting_campaign_uuid: null
agreed_posting_campaign_term: false
---

Cloudflare D1は「SQLite互換」と紹介されることが多く、実際SQLはほぼそのまま動きます。ただ、ローカルのSQLiteから移行してみると「SQLiteのつもりで書くと動かない」制約がいくつかあります。

一番大きいのが**明示的なトランザクションが使えない**ことです。ドキュメントを読むだけだと実感が薄いので、実際に叩いてどんなエラーが返るのかを確かめました。

## 実測1: BEGIN TRANSACTIONは拒否される

```bash
$ wrangler d1 execute my-db --local --command "BEGIN TRANSACTION"
```

```
D1 runs your SQL in a transaction for you.
Please export an SQL file from your SQLite database and try again.
```

はっきり断られます。エラーメッセージが答えそのもので、**D1は個々のクエリ(またはbatch)を自動的にトランザクションで包む**設計です。アプリ側が `BEGIN` ... `COMMIT` で任意の範囲を括る、対話的なトランザクションは提供されていません。

接続を掴みっぱなしにして長いトランザクションを張る、というモデルがそもそもサーバーレスDBと相性が悪いので、設計として割り切られている形です。

## 実測2: PRAGMAもほぼ封じられている

ついでにローカルSQLite時代の設定を流すとこうなります。

```bash
$ wrangler d1 execute my-db --local --command "PRAGMA journal_mode = WAL"
```

```
✘ [ERROR] not authorized: SQLITE_AUTH
```

ジャーナルモードのような低レベル設定はD1側の管理領域で、アプリからは触れません。移行時はスキーマファイルから `PRAGMA` 行を消すことになります(外部キー制約はデフォルトで有効なので `PRAGMA foreign_keys = ON` も不要です)。

## ではアトミックな複数文はどう書くか: batch()

「AをINSERTして、Bも更新して、途中で失敗したら全部無かったことにしたい」という普通の要求には `batch()` を使います。

```ts
// D1の素のAPI
const results = await env.DB.batch([
  env.DB.prepare("INSERT INTO orders (id, user_id) VALUES (?, ?)").bind(orderId, userId),
  env.DB.prepare("UPDATE inventory SET stock = stock - 1 WHERE item_id = ?").bind(itemId),
]);
```

batchに渡した文の並びは**1つのトランザクションとして実行**され、途中の文が失敗すると全体がロールバックされます。さらに複数文が1回のラウンドトリップで送られるので、ネットワーク的にも得です(D1はクエリ回数がレイテンシに直結するので、これが効きます)。

Drizzle ORMを使っている場合も同じ考え方で、`db.batch([...])` にクエリを配列で渡せます。

```ts
await db.batch([
  db.insert(orders).values({ id: orderId, userId }),
  db.update(inventory).set({ stock: sql`${inventory.stock} - 1` }).where(eq(inventory.itemId, itemId)),
]);
```

## batchで書けないケースが本当の設計ポイント

batchはあくまで「文の配列を先に確定できる」場合の道具です。SQLiteの対話的トランザクションでよくやる、

1. SELECTで現在値を読む
2. アプリ側のロジックで判断する
3. 結果に応じてUPDATEする

という**読んでから書く**パターンは、batchの中に条件分岐を挟めないのでそのままでは書けません。対処はだいたい次のどれかになります。

- **1文のSQLに畳む**: `UPDATE inventory SET stock = stock - 1 WHERE item_id = ? AND stock > 0` のように、条件判断をWHEREに押し込んで、`meta.changes` が0かどうかで成否を見る
- **楽観ロック**: 読んだときのバージョン値をUPDATEのWHEREに含め、changesが0なら再試行する
- **本当に強い整合性が必要な部分はDurable Objectsに寄せる**: 1エンティティ単位の直列化が必要なら、そこだけD1ではなくDOのストレージが適材です

個人開発のCRUDアプリだと、実際には「1文に畳む」でほとんど片付きます。私が移行したアプリでも、対話的トランザクションがどうしても必要な箇所は結局ありませんでした。

## まとめ

| SQLiteの習慣 | D1では |
|---|---|
| `BEGIN` ... `COMMIT` | 不可(自動トランザクション)。実測エラー: "D1 runs your SQL in a transaction for you" |
| `PRAGMA journal_mode` 等 | 不可(SQLITE_AUTH)。D1側の管理領域 |
| 複数文のアトミック実行 | `batch()`(1トランザクション+1ラウンドトリップ) |
| 読んでから書く | WHEREに畳む / 楽観ロック / 必要ならDurable Objects |

「SQLite互換」はSQL方言の話であって、トランザクションモデルは別物です。移行前にこの1点だけ頭に入れておくと、設計で迷いません。

## 環境

- Cloudflare D1 / wrangler 4.113(実測は `--local`。リモートも同じ制約です)
- Drizzle ORM 0.41(batch API)
