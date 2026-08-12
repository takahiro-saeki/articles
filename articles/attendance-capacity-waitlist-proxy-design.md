---
title: "定員、キャンセル待ち、代理入力がある出欠管理のデータ設計"
emoji: "🪑"
type: "tech"
topics: ["database", "nextjs", "drizzle", "typescript", "設計"]
published: true
---

単純な出欠表は、ユーザー、予定、参加状態の3つで作れます。ここへ定員、キャンセル待ち、ゲスト、管理者の代理入力を加えると、「参加」という値だけでは状態を表せなくなります。

SquadNoteでは、回答状態と待機列上の位置を分けて持たせました。キャンセル待ちは独立した回答値ではなく、参加表明した人を定員で区切った結果です。

## attendanceの中心となる列

メンバーの出欠には次の情報があります。

```ts
type Attendance = {
  id: string;
  scheduleId: string;
  userId: string;
  status: "attending" | "absent" | "maybe";
  comment: string | null;
  attendingSince: Date | null;
  updatedByAdmin: boolean;
  createdAt: Date;
  updatedAt: Date;
};
```

`status`へ`waitlisted`を追加しなかったのは、定員変更や他の参加者の取消によって自動的に定員内へ移るためです。本人の回答は`attending`のままで、現在の待機状態を計算します。

## createdAtとは別にattendingSinceを持つ

回答を作成した時刻と、参加を表明した時刻は違います。先に不参加で回答した人が後から参加へ変えた場合、待機列では変更時点へ並びます。

```ts
if (newStatus !== "attending") return null;
if (previousStatus === "attending") return previousAttendingSince ?? now;
return now;
```

コメント編集では値を維持し、一度参加をやめたら`null`へ戻します。再参加時には新しい時刻が入ります。

## ゲストも同じ定員を消費する

ゲストはアカウントを持たず、管理者が名前を代理入力します。メンバーとは別テーブルですが、定員計算では一つの列へ結合します。

```ts
const queue = [...memberEntries, ...guestEntries]
  .sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));

const insideCapacity = queue.slice(0, capacity);
const waitlisted = queue.slice(capacity);
```

ゲストに`attendingSince`がない現在の設計では`createdAt`を使います。メンバーとゲストを別々に定員計算しないことが重要です。

## 代理入力の履歴を残す

管理者が他のメンバーの回答を変更できるため、`updatedByAdmin`を持たせています。本人が変更した回答と区別でき、画面表示や問い合わせ時の確認に使えます。

代理入力でも待機列の規則は同じです。管理者が参加へ変更した時点で`attendingSince`を設定し、参加を外した場合は繰り上がるメンバーを計算します。

## 定員変更も出欠変更と同じイベントとして扱う

定員を10人から11人へ増やせば、先頭の待機者が繰り上がります。参加取消だけを通知の起点にすると、この経路を取りこぼします。

処理では変更前後の`capacity`で待機列を作り、差分を取ります。

```ts
const before = computeWaitlist(oldCapacity, members, guests);
const after = computeWaitlist(newCapacity, members, guests);
const promoted = promotedMemberIds(before, after, members);
```

表示上の待機状態はAPIが返します。Webとモバイルで同じ計算を持たせません。

この設計では待機列を毎回計算しています。参加者数が大きくなれば、順位の永続化や更新の直列化も検討対象です。現在の規模では、元データから再現できることと、ルールを一か所に置くことを優先しました。
