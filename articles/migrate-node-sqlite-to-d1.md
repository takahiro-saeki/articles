---
title: "node:sqliteで動いていたNext.jsアプリをCloudflare D1に移行する"
emoji: "🗄️"
type: "tech"
topics: ["cloudflare", "d1", "nextjs", "sqlite", "typescript"]
published: true
---

ローカルで動かしていた自作のNext.jsアプリを、外出先からも使えるようにCloudflare Workersへデプロイすることにしました。問題はDBです。このアプリはNode.js標準の `node:sqlite` でローカルのSQLiteファイルに読み書きしていて、Workersのランタイムに `node:sqlite` はありません。

デプロイ先に合わせて、DBをSQLite互換のD1へ移しました。今回使っていたSQLはそのまま流用でき、作業の中心はDB層を同期APIから非同期APIへ書き換えることでした。この記事では、そのときに変更した箇所を順番に紹介します。

## 移行前の構成

Node.js 22以降に入った `node:sqlite` を使った、素朴な同期APIのDB層です。

```ts
// src/server/db.ts(移行前)
import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync(DB_PATH);
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS clients ( ... );
`);

export function listClients(): Client[] {
  const rows = db.prepare(`SELECT * FROM clients ORDER BY created_at`).all();
  return rows.map(toClient);
}
```

接続時にスキーマを `exec` で流し、クエリはすべて同期呼び出し。ローカル専用ならこれで十分でした。

## 移行でやることは4つ

1. スキーマ定義をマイグレーションファイルに分離する
2. DB層を非同期のD1 APIに書き換える
3. D1バインディングの取得経路を作る
4. 呼び出し側(APIルート)にawaitを足す

順番に見ていきます。

### 1. スキーマをmigrations/に分離

D1はマイグレーション管理の仕組みを持っているので、コード内の `exec` で流していたスキーマを `migrations/0001_init.sql` に移します。

```sql
-- migrations/0001_init.sql
CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

このとき `PRAGMA journal_mode = WAL;` は削除しました。ジャーナルモードはD1側が管理する領域で、アプリから指定するものではなくなります。外部キー制約はD1ではデフォルトで有効なので、`PRAGMA foreign_keys = ON` も不要です。

適用はwranglerから行います。ローカルと本番で同じファイルを使えるのが良いところです。

```bash
wrangler d1 migrations apply my-db --local   # ローカル
wrangler d1 migrations apply my-db --remote  # 本番
```

### 2. DB層を非同期APIに書き換える

ここが移行の本体です。D1のAPIは全部非同期なので、同期前提だった関数を1つずつasyncにしていきます。

```ts
// src/server/db.ts(移行後)
export async function listClients(): Promise<Client[]> {
  const { results } = await getDb()
    .prepare(`SELECT * FROM clients ORDER BY created_at`)
    .all<ClientRow>();
  return results.map(toClient);
}
```

書き換えのパターンはだいたい決まっています。

| node:sqlite | D1 |
|---|---|
| `.prepare(sql).all(...params)` | `.prepare(sql).bind(...params).all()` |
| `.prepare(sql).get(...params)` | `.prepare(sql).bind(...params).first()` |
| `.prepare(sql).run(...params)` | `.prepare(sql).bind(...params).run()` |
| `result.changes` | `result.meta.changes` |

パラメータを `bind()` で先に渡す形になるのと、更新件数の取得場所が `meta` の下に移るのが主な差分です。今回使っていたSQLは変更せずに移行できました。

1つだけ設計上の注意があります。D1には対話的なトランザクション(`BEGIN` ... `COMMIT`)がなく、複数文をアトミックに実行したい場合は `batch()` に文の配列を渡す形になります。同期SQLite時代にトランザクションへ依存していたコードがあると、ここは書き方の見直しが必要です。

### 3. バインディングの取得経路

WorkersではDBはグローバルな接続ではなく、リクエストコンテキストから取るバインディングになります。Next.jsをWorkersで動かす@opennextjs/cloudflareを使っている場合は `getCloudflareContext()` 経由です。

```ts
import { getCloudflareContext } from "@opennextjs/cloudflare";

function getDb() {
  return getCloudflareContext().env.DB;
}
```

`wrangler.jsonc` にはD1バインディングを定義しておきます。

```jsonc
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "my-db",
      "database_id": "wrangler d1 create の出力で置き換える",
      "migrations_dir": "migrations"
    }
  ]
}
```

### 4. 呼び出し側にawaitを足す

DB層がasyncになったので、APIルート側の呼び出しにawaitを足して回ります。Next.jsのRoute Handlerは元からasync関数なので、構造の変更はなく機械的な作業でした。

```ts
export async function GET() {
  return Response.json({ clients: await listClients() });
}
```

戻り値を `Promise` に変えると、awaitを付け忘れた箇所の多くは型チェックで見つけられます。型が広く定義されている箇所は見逃す可能性があるため、APIの動作確認も合わせて行いました。

## ローカル開発はどうなるか

移行前は「ローカルのSQLiteファイル」でしたが、移行後は `next dev` でもD1のローカルシミュレーション(miniflare)を使います。next.config.tsに1行足すだけです。

```ts
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

initOpenNextCloudflareForDev();
```

これで開発中も `wrangler.jsonc` のバインディングを利用でき、ローカル用のデータは `.wrangler/state` 配下に保存されます。本番とローカルで同じDB層とマイグレーションを使えるようになりました。ただし、ローカル環境はD1本番環境そのものではないため、デプロイ前にはdev環境でも確認しています。

移行前のSQLiteファイルにデータがある場合は、`sqlite3` でSQLを出力し、`wrangler d1 execute my-db --remote --file=dump.sql` でD1へ取り込めます。私の場合は移行時点でデータがほぼ空だったので、この工程は省略しました。

## 移行してみて

作業の大半は同期APIから非同期APIへの書き換えで、今回のSQLはそのまま動きました。DB層を小さなモジュールにまとめていたため、変更範囲も追いやすかったです。

現在の利用量はD1とWorkersの無料枠に収まっています。無料枠には上限があるので、読み書きの行数やDBサイズはCloudflareのダッシュボードで確認しています。ローカルのNode.jsとSQLiteで作った小さなアプリをWorkersへ移す場合、D1は検討しやすい移行先でした。

## 参考資料

- [Cloudflare D1: Migrations](https://developers.cloudflare.com/d1/reference/migrations/)
- [Cloudflare D1: Import and export data](https://developers.cloudflare.com/d1/best-practices/import-export-data/)
- [Cloudflare D1: Limits](https://developers.cloudflare.com/d1/platform/limits/)

## 環境

- Next.js(App Router)+ @opennextjs/cloudflare + wrangler
- Cloudflare D1(SQLite互換)
- コード例は実際に移行したアプリのDB層を簡略化したものです
