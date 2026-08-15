---
devto_id: 4400037
canonical_url: https://qiita.com/hiro123/items/d9b6d880355e7a305dfe
title: Why Waitlist Promotion Should Be Determined Server-Side, Not Client-Side
tags: TypeScript, Nextjs, Database, tRPC
published: true
---

_This article is an English translation of the original Japanese article._

In an attendance system with capacity limits, I was initially classifying participants and waitlist entries on the client side. At first, I simply sorted responses by `createdAt` and treated anything beyond capacity as waitlisted. Once I added proxy entry and guest participation, different screens started showing inconsistent results.

Now the waitlist logic is centralized on the server, and the API returns `isWaitlisted`.

## `createdAt` does not reflect participation order

Creating a response record early doesn't mean the person chose to attend from the start. Someone who initially responded "not attending" and later changed to "attending" would jump to the front of the waitlist if sorted by `createdAt`.

To fix this, I save the timestamp when status changed to attending as `attendingSince`.

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

Updating only the comment preserves the position. Canceling and re-attending sends the person to the back of the queue at that moment.

## Merge members and guests into a single queue

Capacity applies to the combined total of members and guests. Calculating them separately could show both groups as within capacity.

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

When timestamps are equal, use the ID as a secondary key. This ensures the same data produces the same order in every request.

## Find promotions by comparing before and after

Compute the waitlist before and after operations like cancellations, proxy entries, guest deletions, or capacity changes.

```ts
const before = computeWaitlist(capacityBefore, membersBefore, guestsBefore);

await updateAttendance();

const after = computeWaitlist(capacityAfter, membersAfter, guestsAfter);
const promotedIds = promotedMemberIds(before, after, membersAfter);
```

Notify only members who were waitlisted before and within capacity after. Computing this diff on the client misses operations by other users or administrators.

## Use API response for display

The list API attaches `isWaitlisted` to each record.

```ts
return rows.map((row) => ({
  ...row,
  isWaitlisted: waitlist.waitlistedMemberIds.has(row.id),
}));
```

Web and mobile clients just display this value. Not duplicating capacity logic across screens avoids inconsistencies like badges differing between the admin panel and user view.

In production, strict handling of concurrent updates would require database transactions or serialization. This fix first eliminated the state where multiple clients each guessed the waitlist using different rules. Waitlist order and promotion notifications are business rules, so having the server return a single result makes them easier to manage.
