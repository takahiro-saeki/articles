---
title: "D1のbatchで更新0件は失敗にならない。ロールバックされる条件を実験する"
emoji: "🗃️"
type: "tech"
topics: ["cloudflare", "d1", "sql", "database"]
published: false
---

在庫を減らしてから注文を保存する処理を、D1の`batch()`に入れたとします。在庫不足ならUPDATEが0件になるように書けば、注文も保存されないでしょうか。

ローカルのD1 bindingで試すと、UPDATEが0件でも、後続のINSERTは成功しました。`batch()`の後でJavaScriptから例外を投げても、保存済みの注文は残ります。

ここで分けて考えるのは、SQLの失敗と業務上の不成立です。`batch()`はSQLが失敗したときの原子性を扱います。「在庫を確保できなかった」というアプリの判断を、自動でSQLエラーへ変換してくれるわけではありません。

## SQLが途中で失敗する場合を基準にする

[公式のD1Databaseの説明](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch)では、文の配列を順に実行し、途中の文が失敗したら一連の処理を中止またはロールバックするとされています。結果の配列も、渡した文の順序に対応します。

この説明の「失敗」に何を含められるかを、次の小さなスキーマで確かめます。実サービスの在庫管理へ導入した変更ではなく、保証の範囲を確認するための実験です。

```sql
CREATE TABLE stock (
  id INTEGER PRIMARY KEY,
  remaining INTEGER NOT NULL CHECK (remaining >= 0)
);
CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  quantity INTEGER NOT NULL
);
```

各ケースの前にテーブルを初期化し、`stock`に`id = 1`、`remaining = 1`の行を入れます。

まず、UPDATEで残数を1減らした後、重複する注文IDをINSERTしました。注文IDは先に1件登録しておきます。

```js
await db.batch([
  db.prepare("UPDATE stock SET remaining = remaining - 1 WHERE id = 1"),
  db.prepare("INSERT INTO orders VALUES (?, ?)").bind("duplicate", 1),
]);
```

返ったのは主キーの重複エラーです。例外を捕まえた後にDBを読むと、残数は1へ戻り、注文は事前に登録した1件だけでした。先行したUPDATEまで取り消されています。

これとは別に、正常なUPDATE、INSERT、SELECTを同じbatchへ入れたケースでは、最後のSELECTが更新後の残数0を返しました。文が順に実行され、後の文から先の変更が見えることも確認しています。

## WHEREで対象がなくなることは、SQLエラーではない

次に、残数1に対して数量2の注文を試します。

```js
const result = await db.batch([
  db.prepare(
    "UPDATE stock SET remaining = remaining - ? WHERE id = 1 AND remaining >= ?",
  ).bind(2, 2),
  db.prepare("INSERT INTO orders (id, quantity) VALUES (?, ?)")
    .bind("order-b", 2),
]);

console.log(result.map(item => item.meta.changes));
```

出力は`[0, 1]`でした。残数が条件に合わないので、UPDATEは何も変えません。しかし、その実行自体はエラーではありません。INSERTも成功し、残数1のまま数量2の注文が保存されました。

この場合、batch内で「UPDATEの結果をJavaScriptで見て、INSERTをやめる」という分岐は行っていません。二つの文を配列へ入れ、どちらも先に渡しているからです。

条件付きUPDATEは単独の更新の成否を調べるには使えます。今回のように、その成否に後続の別テーブル更新を連動させたい場合は、0件を後続処理へどう伝えるかまで設計する必要があります。

## batchの後にthrowしても遅い

結果を受け取ってから、次のように判定してみました。

```js
if (result[0].meta.changes !== 1) {
  throw new Error("No stock was reserved");
}
```

この例外は発生します。それをcatchした後に読み直しても、`order-b`は残っていました。`await db.batch(...)`が成功して戻った時点で、そのSQLの実行は終わっています。後続のJavaScriptの例外は、完了済みのbatchを取り消しません。

| ケース | SQLの結果 | 最後の残数 | 注文 |
| --- | --- | ---: | --- |
| 数量1の正常な更新と登録 | 成功 | 0 | 新規1件 |
| 後続INSERTでID重複 | エラー | 1 | 事前の1件だけ |
| 数量2をWHEREで除外 | 成功、changesは0と1 | 1 | 数量2の新規1件 |
| 残数を負にしてCHECK違反 | エラー | 1 | 0件 |

最後の行は、次の書き方で検証した結果です。

## 不成立を制約へ表現できるか考える

この小さなスキーマには、残数を負にしないCHECK制約があります。残数によるWHERE条件を外して減算すると、数量2では制約違反になります。

```js
await db.batch([
  db.prepare("UPDATE stock SET remaining = remaining - ? WHERE id = 1")
    .bind(2),
  db.prepare("INSERT INTO orders (id, quantity) VALUES (?, ?)")
    .bind("order-c", 2),
]);
```

このケースはCHECKエラーで失敗し、残数1、注文0件でした。今回の入力では、業務上の不成立をSQLの制約違反として表現したことで、batch全体を失敗させられます。

ただし、この断片で在庫管理が完成するわけではありません。`id = 1`の在庫行が存在しない場合は、やはりUPDATEが0件です。数量の正当性、商品と注文の関連、同じ注文を再送した場合、複数商品の扱いもこの実験には含めていません。CHECKを一つ付ければ、あらゆる不成立が検出できるとは考えないようにします。

実装を選ぶときは、失敗にしたい条件を列挙し、それぞれがSQLエラーになるのか、変更0件として正常に終わるのかを確認します。後者なら、同じSQL内の条件や制約で後続更新へ結び付けられるか、処理の単位を変える必要があるかを検討します。

## 再現環境と、確認していない範囲

2026年9月11日に、Node.js `v24.15.0`、Wrangler `4.81.1`、Miniflare `4.20260409.0`で確認しました。Wranglerの[getPlatformProxy](https://developers.cloudflare.com/workers/wrangler/api/#getplatformproxy)でローカルD1のbindingを取得し、`persist: false`、`remoteBindings: false`を指定しています。設定のcompatibility dateは`2026-09-11`です。

[実験スクリプト](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/d1-batch.mjs)には、テーブル作成、4ケース、実行後の行のassertをまとめています。第1引数は、インストール済みWranglerの`package.json`へのパスです。

```bash
node experiments/article-stock-2026-09/d1-batch.mjs \
  ../circle-hub-multi-device-push/apps/web/node_modules/wrangler/package.json
```

ローカルbindingは本番のエミュレーションであり、本番D1への負荷試験や障害試験ではありません。ネットワーク越しの応答消失、外部決済や通知、並行した複数リクエストの試験も行っていません。

成功して戻ったbatchを、その後の`throw`では取り消せませんでした。複数文をまとめたら終わりにせず、「どのSQLが、どの不成立をエラーとして表すか」まで読んでおく必要があります。
