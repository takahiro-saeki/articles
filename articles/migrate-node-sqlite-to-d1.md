---
title: "node:sqliteで動いていたNext.jsアプリをCloudflare D1に移行する"
emoji: "🗄️"
type: "tech"
topics: ["cloudflare", "d1", "nextjs", "sqlite", "typescript"]
published: false
---

ローカルで動かしていた自作のNext.jsアプリを、外出先からも使えるようにCloudflare Workersへデプロイすることにしました。問題はDBです。このアプリはNode.js標準の `node:sqlite` でローカルのSQLiteファイルに読み書きしていて、Workersのランタイムに `node:sqlite` はありません。

デプロイ先をCloudflareにするなら、SQLite互換のマネージドDBであるD1がほぼ一択です。同じSQLite方言なのでSQLはそのまま流用でき、実際の移行作業は「DB層の書き換え」に集中できました。この記事はその移行の実録です。

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

パラメータを `bind()` で先に渡す形になるのと、更新件数の取得場所が `meta` の下に移るのが機械的な差分です。SQLそのものは1文字も変えていません。

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

型チェックを回すと直し漏れが全部エラーになるので、TypeScriptならこの工程で漏れは出ません。

## ローカル開発はどうなるか

移行前は「ローカルのSQLiteファイル」でしたが、移行後は `next dev` でもD1のローカルシミュレーション(miniflare)を使います。next.config.tsに1行足すだけです。

```ts
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

initOpenNextCloudflareForDev();
```

これで開発中も `wrangler.jsonc` のバインディングが生きて、実体は `.wrangler/state` 配下のSQLiteファイルに保存されます。本番とローカルで同じコードパス・同じマイグレーションが使えるので、「ローカルでは動くのに本番で壊れる」の余地がかなり減りました。

移行前のSQLiteファイルにデータがある場合は、`sqlite3` でダンプして `wrangler d1 execute my-db --file=dump.sql` で流し込めます。私の場合は移行時点でデータがほぼ空だったので、この工程は省略しました。

## 移行してみて

作業の大半は「同期→非同期」の書き換えで、SQL自体はそのまま動きました。同じSQLite方言というのはやはり大きくて、PostgreSQLへの移行だったらSQLの検証からやり直しだったはずです。

コストも今のところゼロです。D1の無料枠は個人アプリには十分すぎる量があり、Workersと合わせて完全無料で外から使えるアプリになりました。「ローカルで動いているNode.js + SQLiteのアプリを外に出したい」というケースには、素直におすすめできる移行先です。

## 環境

- Next.js(App Router)+ @opennextjs/cloudflare + wrangler
- Cloudflare D1(SQLite互換)
- コード例は実際に移行したアプリのDB層を簡略化したものです
