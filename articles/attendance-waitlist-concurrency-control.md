---
title: "出欠管理の同時更新をどう防ぐか。D1で考える一意制約、監査ログ、通知の冪等化"
emoji: "🔐"
type: "tech"
topics: ["cloudflare", "d1", "database", "typescript", "設計"]
published: false
---

[前回の記事](https://zenn.dev/hirodeath/articles/attendance-capacity-waitlist-proxy-design)では、参加表明した時刻を基準にキャンセル待ちを計算する設計を書きました。公開後にいただいたコメントをきっかけに、同じ予定へ複数人が同時に操作した場合も考え直しました。

現在のSquadNoteは、元の出欠データから待機列を再計算できます。ただし、出欠変更から繰り上げ通知までを厳密に直列化しているわけではありません。この記事は実装済み機能の紹介ではなく、次に入れたい対策を整理した設計メモです。

## いまの処理で競合が起きる場所

出欠を取り消したときの処理を簡略化すると、次のようになります。

```ts
const before = await loadWaitlist(scheduleId);

await updateAttendance(scheduleId, userId, "not_attending");

const after = await loadWaitlist(scheduleId);
const promoted = findPromotedMembers(before, after);

await notifyPromotedMembers(promoted);
```

一つずつ操作する限り、これで期待した結果になります。問題は、二つの取消がほぼ同時に届いた場合です。どちらの処理も同じ変更前データを読み、変更後には二人分の空きを見る可能性があります。その結果、同じ人を二度「繰り上がった」と判定して、通知を重複させる余地があります。

待機状態を毎回計算する設計は、古い順位をDBへ残さない点では安全です。一方で、複数のDB操作を一つの出来事として扱う保証まではしてくれません。

## 先に守るルールを決める

対策を考える前に、壊してはいけない条件を四つに絞りました。

| 条件 | 守りたいこと |
| --- | --- |
| 出欠の一意性 | 一つの予定に対し、一人の出欠行は一つだけ |
| 待機列の順序 | 同じ入力なら、常に同じ順番になる |
| 操作の記録 | 誰が、いつ、何を、なぜ変えたか追える |
| 通知の冪等性 | 同じ操作を再実行しても通知が増えない |

この四つは、一つの仕組みだけでは守れません。DB制約、操作ログ、通知の重複防止、必要に応じた直列化を重ねます。

## scheduleIdとuserIdを複合一意にする

最初に入れるべきなのは、アプリ側の確認処理ではなくDB制約です。現在は`attendance`に`scheduleId`と`userId`の個別インデックスがありますが、組み合わせの一意制約はありません。

Drizzleのスキーマなら、次のように定義できます。

```ts
import { index, uniqueIndex } from "drizzle-orm/sqlite-core";

export const attendances = createTable(
  "attendance",
  (d) => ({
    id: d.text().primaryKey(),
    scheduleId: d.text("schedule_id").notNull(),
    userId: d.text("user_id").notNull(),
    status: d.text("status").notNull(),
  }),
  (t) => [
    index("attendance_schedule_idx").on(t.scheduleId),
    index("attendance_user_idx").on(t.userId),
    uniqueIndex("attendance_schedule_user_unique").on(
      t.scheduleId,
      t.userId,
    ),
  ],
);
```

これで、同じユーザーから登録リクエストが重なっても出欠行が二つできることはありません。追加前には、既存データに重複がないか確認しておきます。

```sql
SELECT schedule_id, user_id, COUNT(*) AS count
FROM circle-hub_attendance
GROUP BY schedule_id, user_id
HAVING COUNT(*) > 1;
```

重複が見つかった場合は、どちらを残すか決めてから制約を追加します。一意制約は新しい事故を止めてくれますが、すでにある重複までは直してくれません。

## booleanではなく操作ログを残す

現在は管理者による代理入力かどうかを`updatedByAdmin`で判別しています。画面表示には使えますが、「誰が変更したか」「何から何へ変えたか」「理由は何か」までは分かりません。

そこで、出欠行とは別に追記専用の操作ログを持たせます。

```ts
type AttendanceOperation = {
  id: string;              // 1回の操作を表すoperationId
  scheduleId: string;
  targetUserId: string;
  actorUserId: string;
  beforeStatus: string | null;
  afterStatus: string | null;
  reason: string | null;
  createdAt: Date;
};
```

`targetUserId`と`actorUserId`を分けると、本人入力と代理入力を同じ形式で記録できます。操作IDはAPIの入力として受け取り、タイムアウト後の再送でも同じ値を使います。これを主キーにすれば、再試行でログが二重に増えることも防げます。

監査ログは出欠更新に成功したのに残らない状態を避けたいので、状態変更と同じアトミックな処理へ含めます。

## 通知はその場で送らず、送信予定を保存する

現在の実装は、繰り上げを検出するとアプリ内通知をINSERTし、その後にPush通知を送ります。途中で処理が再試行されると、同じ通知が増える可能性があります。

ここはoutboxを挟みます。

```ts
type NotificationOutbox = {
  id: string;
  operationId: string;
  recipientUserId: string;
  type: "waitlist_promoted";
  payload: string;
  deliveredAt: Date | null;
};
```

`operationId + recipientUserId + type`へ一意制約を置き、出欠更新、操作ログ、outboxへの追加をまとめて確定します。通知処理は未送信の行を読み、送信後に`deliveredAt`を更新します。これでアプリ内通知と送信ジョブは重複しません。外部Pushの送信直後に処理が落ちるケースまで含めた完全な一度きりの配送は別の問題なので、送信側は再試行される前提で扱います。

これで同じ操作の再試行には強くなります。ただし、異なる二つの取消操作が同じ人を繰り上げ対象と判定する競合は、操作IDが別なので残ります。outboxだけで同時更新の問題がすべて解けるわけではありません。

## D1ではどこまでbatchに入れるか

Cloudflare D1の`batch()`は、複数のSQL文を順番に実行し、途中で失敗すれば全体をロールバックします。[D1の公式ドキュメント](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch)にも、batch内の文は一つのトランザクションとして扱われるとあります。

出欠更新、操作ログ、outboxのように、実行するSQLが先に決まっている処理とは相性が良いです。

難しいのは、変更前を読み、TypeScriptで繰り上げ対象を決め、その結果に応じて書き込み内容を変える処理です。アプリ側の条件分岐をbatchの途中へ挟むことはできません。

D1だけで完結させるなら、繰り上げ判定をSQLへ寄せて一つのbatchに収める方法があります。もう一つは、予定ごとのrevisionを使った楽観的な競合検出です。読み取ったrevisionが変わっていたら、副作用を出す前に最初から計算し直します。更新件数が0でもbatch自体は失敗しないため、競合時に確実に全体を中断するガードまで設計する必要があります。

ここを曖昧にしたまま、`SELECT`と`UPDATE`を単にbatchへ並べるだけでは直列化にはなりません。

## 厳密な直列化が必要なら予定単位で分ける

同じ予定への更新を必ず一列に並べたい場合は、`scheduleId`ごとにDurable Objectを割り当てる案があります。[Durable Objects](https://developers.cloudflare.com/durable-objects/)は、複数のクライアントが同じ状態を更新する場面の調整に使える仕組みです。

ただし、Durable Objectから外部のD1を`await`している間は、別リクエストが割り込む可能性があります。単に中継するだけでは十分ではありません。厳密さを求めるなら、待機列の判断に必要な状態をDurable ObjectのSQLiteストレージへ置き、出欠変更、操作ログ、outbox追加をローカルのトランザクションで完結させます。[SQLiteストレージの公式ドキュメント](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/)でも、ストレージ操作はアトミックかつ分離された処理として扱われています。

これはD1だけの構成より運用が複雑です。参加者が数十人規模で、同時操作もまれな段階から入れる仕組みではないと考えています。

## SquadNoteで進める順番

まず、複合一意制約と操作IDを追加します。次に操作ログと通知outboxを同じアトミックな書き込みへまとめ、二重送信を再現する並行テストを用意します。

そのテストでD1のbatchに収められない競合が残るなら、revisionによる再試行を検討します。それでも厳密な順序が必要になった時点で、予定単位のDurable Objectへ切り出します。

一意制約だけでは繰り上げ通知を守れず、outboxだけでは異なる操作同士の競合を止められません。どの事故をどの層で防ぐのかを分けて考えると、必要以上に大きな仕組みを入れずに済みます。
