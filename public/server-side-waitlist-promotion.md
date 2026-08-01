---
title: キャンセル待ちの繰り上げをクライアントではなくサーバーで確定させる理由
tags:
  - TypeScript
  - Nextjs
  - Database
  - 設計
  - tRPC
private: false
updated_at: ''
id: null
organization_url_name: null
slide: false
ignorePublish: true
posting_campaign_uuid: null
agreed_posting_campaign_term: false
---

定員のある出欠管理で、参加者とキャンセル待ちをクライアント側で分類していました。最初は`createdAt`順に並べて定員以降を待機扱いにするだけでしたが、代理入力とゲスト参加を加えたところ、画面ごとに結果がずれるようになりました。

現在は待機列の判定をサーバーへ集約し、APIが`isWaitlisted`を返しています。

## `createdAt`では参加順にならない

回答レコードを早く作った人が、最初から参加を選んでいたとは限りません。先に「不参加」と回答し、後日「参加」へ変えた人を`createdAt`で並べると、待機列の先頭へ割り込めます。

そこで、参加へ変わった時刻を`attendingSince`として保存します。

```ts
export function nextAttendingSince(
  previousStatus: string | null,
  newStatus: string,
  previous: Date | null,
  now: Date,
): Date | null {
  if (newStatus !== "attending") return null;
  if (previousStatus === "attending") return previous ?? now;
  return now;
}
```

コメントだけを更新した場合は順位を維持します。参加を取り下げて再参加した場合は、その時点で最後尾へ並び直します。

## メンバーとゲストを1本の列へ入れる

定員はメンバーとゲストの合計へ適用します。別々に計算すると、双方が定員内と表示される可能性があります。

```ts
const queue = [
  ...members
    .filter((item) => item.status === "attending")
    .map((item) => ({ kind: "member", id: item.id, at: joinedAt(item) })),
  ...guests
    .filter((item) => item.status === "attending")
    .map((item) => ({ kind: "guest", id: item.id, at: item.createdAt })),
].sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));

const waitlisted = queue.slice(capacity);
```

時刻が同じ場合はIDを第二キーにします。同じデータなら、どのリクエストでも同じ順序になるようにするためです。

## 変更前後の差分で繰り上げを見つける

参加取り下げや管理者の代理入力、ゲスト削除、定員変更の前後で待機列を計算します。

```ts
const before = computeWaitlist(capacityBefore, membersBefore, guestsBefore);

await updateAttendance();

const after = computeWaitlist(capacityAfter, membersAfter, guestsAfter);
const promotedIds = promotedMemberIds(before, after, membersAfter);
```

変更前は待機中で、変更後は定員内になったメンバーだけへ通知します。クライアントでこの差分を計算すると、他ユーザーの操作や管理者の変更を取りこぼします。

## APIの返却値を表示へ使う

一覧APIは各レコードへ`isWaitlisted`を付けます。

```ts
return rows.map((row) => ({
  ...row,
  isWaitlisted: waitlist.waitlistedMemberIds.has(row.id),
}));
```

Webとモバイルはこの値を表示するだけです。定員判定を各画面へ複製しないので、管理画面だけバッジが違う、といったずれを避けられます。

本番で同時更新を厳密に扱うなら、DBのトランザクションや直列化も必要です。今回の修正でまず解消したのは、複数クライアントがそれぞれ異なる規則で待機列を推測していた状態でした。待機順と繰り上げ通知は業務ルールなので、サーバーが一つの結果を返す方が扱いやすくなります。
