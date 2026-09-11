---
title: "Durable Objectsへデータを分ける前に、D1の横断クエリを棚卸しする"
emoji: "🏠"
type: "tech"
topics: ["cloudflare", "durableobjects", "d1", "設計"]
published: false
---

ルームごとの状態をDurable Objectsへ移すとき、保存用のSQLが似ているからといって、D1のクエリをそのまま移せるとは限りません。各ObjectのSQLiteは、そのObject専用のストレージです。一つのD1に置いていた全ルームのデータを分けると、全体取得の経路も変わります。

この記事で確かめるのは、その境界です。同じ合成データを一つのD1と二つのObjectへ保存し、個別取得と横断取得をローカルで比較しました。実サービスの移行は行っていません。後半の移行手順は、実験を基にした設計案です。

## まず、移行で失いたくないクエリを置く

小さなルーム管理を考えます。`red`に`alice`、`blue`に`bob`が参加しています。一つのD1へ保存する場合、次のテーブルで両方を扱えます。

```sql
CREATE TABLE membership (
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  PRIMARY KEY (room_id, user_id)
)
```

ルームを指定した一覧だけでなく、管理画面の全参加者も一つのクエリで取得できます。

```sql
SELECT room_id, user_id FROM membership ORDER BY room_id, user_id
```

この例は全件取得の比較用です。実際の大きな管理画面にはページングが必要ですし、全件を読み出すことが望ましいとは限りません。ここでは、ルームの境界を越えた問い合わせが一つのDBの中で完結している点に注目します。

[Durable Object Storageの仕様](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/)では、付属ストレージは個々のObjectに閉じています。別のObjectのテーブルを、この`SELECT`へ自動的に加えてくれる共有DBではありません。

## 二つのObjectに同じ形のテーブルを作る

実験の`Room`クラスは、初期化時に`member`テーブルを作り、RPCで参加者を追加・取得します。各Object自体がルームを表すので、このテーブルには`room_id`を持たせていません。

```js
import { DurableObject } from 'cloudflare:workers';

export class Room extends DurableObject {
  /** @param {DurableObjectState} ctx @param {Env} env */
  constructor(ctx, env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS member (user_id TEXT PRIMARY KEY)');
    });
  }

  /** @param {string} userId */
  add(userId) {
    this.ctx.storage.sql.exec('INSERT INTO member (user_id) VALUES (?)', userId);
  }

  members() {
    return this.ctx.storage.sql.exec('SELECT user_id FROM member ORDER BY user_id').toArray();
  }
}
```

`Env`はWranglerのbinding設定から生成した型です。`blockConcurrencyWhile`は初期化中のイベント配送を制御するために使っています。長い外部通信をここへ追加する例ではありません。[State APIの説明](https://developers.cloudflare.com/durable-objects/api/state/)を確認して使い分けます。

呼び出し側は、ルーム名からObjectを取得します。

```js
const red = env.ROOMS.getByName('room:red');
const blue = env.ROOMS.getByName('room:blue');
await red.add('alice');
await blue.add('bob');
```

同じnamespaceで同じ名前を使うことが、同じ保存先へ戻る手段になります。[Namespace API](https://developers.cloudflare.com/durable-objects/api/namespace/)では、名前からの取得と新しい一意IDの生成が別の操作です。毎回`newUniqueId()`を呼んでも、既存ルームの検索にはなりません。

## ローカル実行で返った結果

書き込みを終えてから、順に取得しました。実験コードではHTTP応答の成功も含めて8個のassertionを通しています。

| 取得方法 | 返ったデータ |
| --- | --- |
| `room:red`の`members()` | `alice`だけ |
| `room:blue`の`members()` | `bob`だけ |
| 同じ`room:red`という名前で再取得 | `alice`だけ |
| `newUniqueId()`で作った別Object | 空配列 |
| D1の全体クエリ | `blue/bob`と`red/alice` |
| 両ルームを明示してRPCで取得・結合 | D1の全体クエリと一致 |
| `red`だけを対象にして取得・結合 | `red/alice`だけ |

Objectを分けた後も、アプリケーション側で集めることはできます。実験で使った結合処理は次のとおりです。

```js
/** @param {Env} env @param {string[]} roomIds */
async function collectMembers(env, roomIds) {
  const groups = await Promise.all(roomIds.map(async roomId => {
    const room = env.ROOMS.getByName(`room:${roomId}`);
    const members = await room.members();
    return members.map(member => ({ room_id: roomId, user_id: member.user_id }));
  }));
  return groups.flat().sort((a, b) => a.room_id.localeCompare(b.room_id));
}
```

ただし、この関数へ渡すルーム一覧は呼び出し側の責任です。`['red']`を渡した結果が1件でも、全体で1件しかないとは言えません。実験ではルーム一覧を固定しました。Object全体の列挙や一覧の永続管理は実装していません。

各RPCの成功を待って配列を結合する処理は、全Objectを同じ時刻で読むトランザクションにもなりません。今回は書き込みを止めた状態なので一致しました。同時更新があるときの一貫した全体スナップショットは検証していません。また、どれかのRPCが失敗するとこの`Promise.all`は失敗します。部分結果を返すか、取得全体をやり直すかは、画面の要件に応じて別途決めます。

## 移行前に、読み取りと書き込みの置き場所を決める

この結果から、移行候補を調べるなら、既存のクエリを次のように並べます。右列は今回の実装ではなく、検討する項目です。

| 既存の処理 | Objectごとに保存した場合の検討点 |
| --- | --- |
| 一つのルームの参加者取得 | ルームIDから同じObjectへ到達できるか |
| 管理画面で全ルームを検索 | 集約用データを別に持つか、対象一覧から収集するか |
| ユーザーが参加中の全ルームを取得 | ユーザーを起点に探せる索引をどこへ置くか |
| 複数ルームへ影響する変更 | 途中まで成功した状態をどう検出・回復するか |

全体検索のためにD1へ集約用のデータを残す設計も考えられます。その場合は、どちらが更新の正本か、集約側の遅れをどこまで許すか、更新が欠けたときに何から再構築するかを決めます。D1とObjectの両方へ順番に書くだけでは、二つのストレージの更新が一つのトランザクションになるわけではありません。この実験の二重保存は比較用の準備であり、同期方式の実装ではありません。

D1へデータを残し、Objectへ同じルームの通信や処理の調整だけを任せる選択肢もあります。逆に、状態をルーム内で完結させたいなら、Object内の保存に意味があります。[Durable Objectsの概要](https://developers.cloudflare.com/durable-objects/concepts/what-are-durable-objects/)が説明する実行主体と保存先の組み合わせを、自分の処理単位へ当てはめます。

読み取りと書き込みの経路を棚卸しすると、SQLiteという共通点だけでは分からない横断処理の変更を確認できます。

## 検証環境と再現コード

2026年9月11日に、Node.js `v24.15.0`、Wrangler `4.131.0`、その依存のMiniflare `5.20260910.0-alpha`で確認しました。Workerの互換日は`2026-09-11`です。Miniflareの旧形式オプションは、同パッケージの`convertV4MiniflareOptions`で変換しています。型はWranglerで生成し、`@cloudflare/workers-types`の`5.20260911.1`とTypeScript `5.9.3`で`checkJs`を通しました。

[ローカル実験コード](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/do-partitions.mjs)と同じディレクトリの`do-partitions/`にWorkerと設定を置いています。[実行結果](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/production/2026-09/batch-04/do-partitions.json)も保存しています。

再現時は、別の作業用ディレクトリへ指定版のWranglerをインストールし、その`node_modules/wrangler/package.json`のパスを実験スクリプトの引数に渡します。リモートのD1やObjectには接続しません。保存領域は一時的で、終了時にランタイムを破棄します。

性能、料金、WebSocket、障害をまたぐ復旧、本番でのデータ移行はこの実験の対象外です。結果が示すのは、保存先をObjectごとに分けた後の取得範囲と、全体取得に必要となるアプリケーション側の処理です。
