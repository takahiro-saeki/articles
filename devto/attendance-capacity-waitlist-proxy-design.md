---
devto_id: 4373057
canonical_url: https://zenn.dev/hirodeath/articles/attendance-capacity-waitlist-proxy-design
title: "Data design for attendance management with capacity, waitlist, and proxy input"
tags: database, nextjs, drizzle, typescript
published: true
---

This article is an English translation of the original Japanese article.

A simple attendance sheet can be built with three things: user, schedule, and participation state. When you add capacity, waitlist, guests, and admin proxy input, a single "attending" value can no longer represent the state.

In SquadNote, I separated response state from waitlist position. Waitlist is not an independent response value, but a result of dividing people who expressed attendance by capacity.

## Core columns in attendance

Member attendance has this information:

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

I did not add `waitlisted` to `status` because capacity changes or other participants' cancellations automatically move people inside capacity. The user's own response remains `attending`, and the current waitlist state is computed.

## attendingSince separate from createdAt

The time a response was created differs from the time attendance was expressed. If someone who initially responded absent later changes to attending, they are placed in the waitlist at the time of change.

```ts
if (newStatus !== "attending") return null;
if (previousStatus === "attending") return previousAttendingSince ?? now;
return now;
```

Comment edits preserve the value, and once attendance is cancelled, it resets to `null`. On re-attendance, a new timestamp is set.

## Guests consume the same capacity

Guests do not have accounts; admins enter their names as proxy input. They are in a separate table from members, but capacity calculation joins them into one list.

```ts
const queue = [...memberEntries, ...guestEntries]
  .sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));

const insideCapacity = queue.slice(0, capacity);
const waitlisted = queue.slice(capacity);
```

In the current design, guests lack `attendingSince`, so I use `createdAt`. The important point is not calculating capacity separately for members and guests.

## Record proxy input history

Because admins can change other members' responses, I have `updatedByAdmin`. This distinguishes admin-changed responses from self-changed ones, useful for screen display and inquiry verification.

Even for proxy input, waitlist rules are the same. When an admin changes to attending, `attendingSince` is set at that moment; when removing attendance, promoted members are calculated.

## Capacity changes are treated as the same event as attendance changes

If capacity increases from 10 to 11, the top waitlisted person is promoted. If only cancellations trigger notifications, this path is missed.

Processing creates waitlists with before and after `capacity`, then takes the difference.

```ts
const before = computeWaitlist(oldCapacity, members, guests);
const after = computeWaitlist(newCapacity, members, guests);
const promoted = promotedMemberIds(before, after, members);
```

Display waitlist state is returned by the API. I do not duplicate the same calculation in web and mobile.

This design recalculates the waitlist every time. If participant count grows large, persisting rank or serializing updates become considerations. At the current scale, I prioritized being able to reproduce from source data and keeping rules in one place.
