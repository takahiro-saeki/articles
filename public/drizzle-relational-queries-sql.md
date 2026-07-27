---
title: DrizzleのwithはJOINだと思っていたので、実際に発行されるSQLを覗いてみた
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

個人開発2本のバックエンドをDrizzle + Cloudflare D1で運用しているのですが、relational queries(`db.query.xxx.findMany({ with: ... })`)が実際にどんなSQLになるのか、ちゃんと確かめないまま使っていました。

JOINなのか、それともN+1になっているのか。気になったのでloggerを仕込んで実測したところ、どちらでもありませんでした。相関サブクエリと`json_group_array`を使った1本のSQLに変換されています。何段ネストしてもクエリ数は1のままです。

この記事では実測したSQLをそのまま貼りながら、この挙動を確認していきます。

## 気になっていたこと

Drizzleでリレーション先を含めて取得するとき、こう書きます。

```ts
// メンバー一覧を、ユーザー情報付きで取得
const members = await db.query.memberships.findMany({
  where: eq(memberships.orgId, input.orgId),
  with: { user: { columns: { id: true, name: true, email: true } } },
});
```

ORMの経験則から、この書き味だとActiveRecord的な遅延ロード(N+1の温床)か、JOINして行を複製してアプリ側で組み立てるかのどちらかだろうと想像していました。D1はクエリ回数がそのままレイテンシに響く構造なので、もしN+1だったら結構まずい。それで重い腰を上げて確認した次第です。

## 検証方法

Drizzleは`drizzle()`の初期化時にカスタムloggerを渡せます。これで発行されるSQLを全部捕まえられます。

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

スキーマは運用中のサービス(サークル管理アプリ)のもので、`organization` 1対多 `membership` 多対1 `user` という素直な構成です。環境はdrizzle-orm 0.41 + SQLite(libsql)。D1と同じSQLite方言です。

## 検証1: 多対1(memberships → user)

```ts
await db.query.memberships.findMany({
  with: { user: { columns: { id: true, name: true, email: true } } },
  limit: 3,
});
```

発行されたクエリ数は1。中身はこうでした(読みやすく整形しています)。

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

JOINではなく、SELECT句の中の相関サブクエリでした。リレーション先のuserは`json_array(...)`でJSON配列にシリアライズされて、1カラムに詰められて返ってきます。

## 検証2: 1対多(organizations → memberships)

```ts
await db.query.organizations.findMany({
  with: { memberships: true },
  limit: 2,
});
```

こちらも1クエリ。1対多では`json_group_array`が出てきます。

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

`json_group_array`はSQLiteの集約関数で、複数行を1つのJSON配列に畳み込みます。面白いのは`coalesce(..., json_array())`の部分で、子が0件でもnullではなく空配列が返るようになっています。`rows.memberships`が常に配列であるという型の保証が、SQLレベルで作られているわけです。

## 検証3: 2段ネスト(組織 → メンバー → ユーザー)

```ts
await db.query.organizations.findMany({
  with: { memberships: { with: { user: { columns: { name: true } } } } },
  limit: 2,
});
```

これでもクエリ数は1でした。サブクエリがそのまま入れ子になります。

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

## 比較: 普通のleftJoinはどうなるか

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

こちらは想像通りの素直なJOINです。ただしJOINは親の行が子の数だけ複製されるので、ネスト構造への組み立て直しはアプリ側の仕事になります。relational queriesはその組み立てをJSON集約としてSQL側に押し込んでいる、と言えます。

## D1で使う場合、この設計はかなり都合が良い

何段ネストしても1クエリという性質は、DBへのラウンドトリップが高くつく環境で効きます。

Cloudflare D1はWorkerからバインディング越しにクエリを投げる構造上、クエリ回数がレイテンシに直結します。もしrelational queriesがN+1方式だったら、メンバー20人の一覧画面で21回のラウンドトリップが発生するところでした。実際には常に1回で済んでいます。D1とDrizzleの組み合わせが実運用で快適だった理由の一端は、たぶんここです。

一方で気にしておくべき点もあります。

- 大量の子レコードを`json_group_array`で畳むと1行が巨大なJSON文字列になる。子側にもlimitを効かせる設計が大事
- 相関サブクエリなので、結合キー(この例では`membership.userId`と`membership.orgId`)へのインデックスは引き続き重要
- 生成されるSQLは読みにくいので、スロークエリを調べるときは`EXPLAIN QUERY PLAN`とセットで見る

## おわりに

「withはJOINの糖衣構文だろう」という思い込みは外れていて、実際はJSONを組み立てる1本のSQLへ変換するコンパイラでした。

loggerを1つ挟むだけでORMの中身は簡単に覗けるので、「なんとなく大丈夫」で使っている部分がある方は一度実測してみると発見があると思います。私はありました。

## 環境

- drizzle-orm 0.41 / @libsql/client(SQLite方言。Cloudflare D1も同じSQLite)
- スキーマとクエリは運用中の個人開発プロダクトのものを簡略化
- 生成されるSQLの形はDBの方言やdrizzleのバージョンで変わる可能性があります。PostgreSQLではlateral joinとjson系関数の組み合わせになるようです
