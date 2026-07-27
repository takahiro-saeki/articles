---
title: Drizzleの `with` はJOINではなかった ― relational queriesが発行する実SQLを覗いてみた
tags:
  - Drizzle
  - TypeScript
  - SQLite
  - D1
  - ORM
private: false
updated_at: ''
id: null
organization_url_name: null
slide: false
ignorePublish: false
posting_campaign_uuid: null
agreed_posting_campaign_term: false
---

## TL;DR

- Drizzleのrelational queries(`db.query.xxx.findMany({ with: ... })`)は、**JOINでもN+1でもなく、相関サブクエリ + `json_array` / `json_group_array` を使った1本のSQL**に変換される(SQLite系での実測)
- 2段ネストしても**クエリ数は1のまま**(サブクエリが入れ子になる)
- この設計は、Cloudflare D1のような**ラウンドトリップが高くつくDB**と相性が良い
- 実プロダクトのスキーマとカスタムloggerで実測した結果を貼りながら解説します

## 「N+1になってないよね?」という不安

Drizzleでリレーション先を含めて取得するとき、こう書きます。

```ts
// メンバー一覧を、ユーザー情報付きで取得
const members = await db.query.memberships.findMany({
  where: eq(memberships.orgId, input.orgId),
  with: { user: { columns: { id: true, name: true, email: true } } },
});
```

素直に読めば「membershipsを引いてから、各行のuserを引くのかな? それともJOIN?」と思うはずです。ORMの経験則的には、この書き味は

- ActiveRecord的な**遅延ロード(N+1の温床)**か
- **JOINして行を複製し、アプリ側で組み立てる**か

のどちらかを連想します。私は個人開発2本(Web+iOS)のバックエンドをDrizzle + Cloudflare D1で運用していて、この部分を「たぶん大丈夫」のまま使っていたので、実際に発行されるSQLを覗いてみました。

## 検証方法

Drizzleは `drizzle()` 初期化時にカスタムloggerを渡せます。これで発行されるSQLを全部捕まえます。

```ts
const queries: { query: string; params: unknown[] }[] = [];

const db = drizzle(client, {
  schema,
  logger: {
    logQuery(query, params) {
      queries.push({ query, params });
    },
  },
});
```

スキーマは実プロダクト(サークル管理サービス)のもので、`organization` 1—多 `membership` 多—1 `user` という素直なリレーション構成です。環境は drizzle-orm 0.41 + SQLite(libsql / D1と同じSQLite方言)です。

## 検証1: 多対1(`memberships` → `user`)

```ts
await db.query.memberships.findMany({
  with: { user: { columns: { id: true, name: true, email: true } } },
  limit: 3,
});
```

**発行されたクエリ数: 1**。中身はこうでした(読みやすく整形)。

```sql
select "id", "userId", "orgId", "role", "joinedAt",
  (select json_array("id", "name", "email") as "data"
   from (select * from "user" "memberships_user"
         where "memberships_user"."id" = "memberships"."userId"
         limit ?) "memberships_user"
  ) as "user"
from "membership" "memberships"
limit ?
```

JOINではなく、**SELECT句の中の相関サブクエリ**でした。リレーション先のuserは `json_array(...)` で**JSONの配列にシリアライズされて1カラムに詰められて**返ってきます。

## 検証2: 1対多(`organizations` → `memberships`)

```ts
await db.query.organizations.findMany({
  with: { memberships: true },
  limit: 2,
});
```

こちらも**1クエリ**。1対多では `json_group_array` が登場します。

```sql
select "id", "name", "genre",
  (select coalesce(json_group_array(
            json_array("id", "userId", "orgId", "role", "joinedAt")
          ), json_array()) as "data"
   from "membership" "organizations_memberships"
   where "organizations_memberships"."orgId" = "organizations"."id"
  ) as "memberships"
from "organization" "organizations"
limit ?
```

- `json_group_array` はSQLiteの集約関数で、**複数行を1つのJSON配列に畳み込み**ます
- `coalesce(..., json_array())` により、子が0件でも `null` ではなく**空配列**が返る — `rows.memberships` が常に配列である型保証はSQLレベルで作られていました

## 検証3: 2段ネスト(組織 → メンバー → ユーザー)

```ts
await db.query.organizations.findMany({
  with: { memberships: { with: { user: { columns: { name: true } } } } },
  limit: 2,
});
```

これでも**クエリ数は1**。サブクエリがそのまま入れ子になります。

```sql
select "id", "name", "genre",
  (select coalesce(json_group_array(
            json_array("id", "userId", "orgId", "role", "joinedAt",
              (select json_array("name") as "data"
               from (select * from "user" "..._user"
                     where "..._user"."id" = "organizations_memberships"."userId"
                     limit ?) "..._user")
            )), json_array()) as "data"
   from "membership" "organizations_memberships"
   where "organizations_memberships"."orgId" = "organizations"."id"
  ) as "memberships"
from "organization" "organizations"
limit ?
```

## 比較: 普通の `leftJoin` はどうなるか

```ts
await db.select().from(memberships)
  .leftJoin(users, eq(memberships.userId, users.id))
  .limit(3);
```

```sql
select "membership"."id", ..., "user"."id", "user"."name", ...
from "membership"
left join "user" on "membership"."userId" = "user"."id"
limit ?
```

こちらは想像通りの素直なJOINです。ただしJOINは**親の行が子の数だけ複製される**ので、ネスト構造に組み立て直すのはアプリ側(または自分)の仕事になります。relational queriesはこの組み立てをJSON集約としてSQL側に押し込んでいる、と言えます。

## なぜこの設計が嬉しいのか(特にD1で)

この「何段ネストしても1クエリ」という性質は、**DBへのラウンドトリップが高くつく環境**で効きます。

Cloudflare D1はWorkerからバインディング越しにクエリを投げる構造上、クエリ回数がそのままレイテンシに響きます。もしrelational queriesがN+1方式だったら、メンバー20人の一覧画面で21回のラウンドトリップが発生するところ、実際には常に1回で済んでいます。「D1 × Drizzle」の組み合わせが実運用で快適な理由の一端はここにありました。

一方でトレードオフもあります。

- 大量の子レコードを `json_group_array` で畳むと、**1行が巨大なJSON文字列**になる(limitを子側にも効かせる設計が大事)
- 相関サブクエリなので、**結合キー(この例では `membership.userId` / `membership.orgId`)へのインデックス**は引き続き重要
- SQLが読みにくくなるため、スロークエリ調査時は `EXPLAIN QUERY PLAN` とセットで

## まとめ

| 書き方 | クエリ数 | SQLの形 | 組み立て |
|---|---|---|---|
| `findMany({ with })` | 常に1 | 相関サブクエリ + json集約 | SQL側で完結 |
| `select().leftJoin()` | 1 | 素直なJOIN(行が複製) | アプリ側で必要 |
| (ちなみに)素朴なループで個別取得 | N+1 | — | — |

「`with` はJOINの糖衣構文だろう」という私の思い込みは外れていました。**JSONを組み立てる1本のSQLへのコンパイラ**というのが実像です。ORMの中身は、loggerを1つ挟むだけで簡単に覗けるので、「なんとなく大丈夫」で使っている部分があればぜひ実測してみてください。

## 環境

- drizzle-orm 0.41 / @libsql/client(SQLite方言。Cloudflare D1も同じSQLite)
- スキーマ・クエリは本番運用中の個人開発プロダクトのものを簡略化
- なお生成されるSQLの形はDBの方言やdrizzleのバージョンで変わり得ます(PostgreSQLではlateral join + json系関数)。手元での実測をおすすめします
