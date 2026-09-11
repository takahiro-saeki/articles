---
title: "What happens when a pasted schedule import is run again?"
published: false
tags: typescript, testing, dataengineering
canonical_url: null
---

Successfully importing pasted schedules does not establish that repeating the input is safe. Parsing, applying results to a form, and retrying persistence can each produce different outcomes.

I read SquadNote's implementation at a fixed commit and ran its parser, Web form application function, and persistence function locally. Successful parsing does not establish that repeated persistence produces the same state. In particular, omitted years and partial failures are not solved merely by removing duplicate lines.

## The inspected feature fills form fields from pasted text

The target is circle-hub at commit `a34608c`. The [implementation commit](https://github.com/takahiro-saeki/circle-hub/commit/68bcd9522a87b34445aac511f403fc9f7be84145) added a shared text parser and paste interfaces for Web and mobile. The [growth document](https://github.com/takahiro-saeki/circle-hub/blob/a34608c611ded6549c1176a7977e68e1bc62a8db/docs/growth/README.md) defined this initiative's completion criterion as delivering one of text pasted from LINE or notes, CSV import, or copying the previous month's schedules.

The path inspected here is pasted text. This article does not treat CSV column mapping or synchronization with an external service as implemented features.

The [parser](https://github.com/takahiro-saeki/circle-hub/blob/a34608c611ded6549c1176a7977e68e1bc62a8db/packages/schedule-text-parser/src/index.ts) extracts a date, start and end times, and location from each line, returning successful rows separately from errors. Its package version is 0.1.0. The UI lets the user review parsed results, apply them to form fields, and then use the ordinary registration operation.

Verification ran on September 11, 2026, with macOS, Node.js 24.15.0, and Asia/Tokyo as the time zone. The source repository was unchanged; the tests used code retrieved from fixed Git revisions.

## Omitting the year can move the same text into the next year

Start with parsing alone. Save the linked parser as `schedule-text-parser.ts` and place the following `check.mjs` in the same directory. Run `node check.mjs` with Node.js 24.15.0. No external libraries are required.

```js
import { parseScheduleText } from "./schedule-text-parser.ts";

const input = "9/10 19:00-21:00 A";
for (const baseDate of [
  new Date(2026, 8, 9, 12),
  new Date(2026, 8, 11, 12),
]) {
  console.log(parseScheduleText(input, { baseDate }).schedules[0].date);
}

const explicit = "2026/9/12 19:00-21:00 A";
const result = parseScheduleText(explicit + "\n" + explicit, {
  baseDate: new Date(2026, 8, 11, 12),
});
console.log(result.schedules.length, result.errors.length);
```

```text
2026-09-10
2027-09-10
2 0
```

When the input omits the year, the implementation chooses the next occurrence relative to the reference date. A month and day earlier than that date move into the following year. In this example, changing the reference date changes the resulting year without changing the input text.

Passing the same line with an explicit year twice also produces 2 successful rows and 0 errors. The parser does not remove duplicate lines.

Results matched when both the input and baseDate were held constant. Comparisons need to include the reference date as an input to parsing. A migration that must be repeated needs either a preserved initial reference date or a way to resume from data with resolved years. That is a proposed design, not an implemented change.

## Applying results again replaces form rows

The `importParsedSchedules` function in the [Web form](https://github.com/takahiro-saeki/circle-hub/blob/a34608c611ded6549c1176a7977e68e1bc62a8db/apps/web/src/app/%28app%29/organizations/%5Bid%5D/schedules/new/page.tsx) passes an array built from the parsed schedules to `setRows`. It does not concatenate it with existing rows.

I extracted the actual function and replaced only the state update destination with an in-memory array. After starting with a manually entered row and applying the same single parsed schedule twice, the final row count was 1. The manual row was no longer present.

That result does not demonstrate deduplication of persisted schedules. It demonstrates replacement of form contents. Reanalyzing and applying the result after manually correcting a date can therefore discard that correction.

The retrieved UI code clears an old analysis result when the pasted text changes, requiring analysis again. It does not, however, merge edits already made in the destination form with a subsequent application of parsed results.

## Inspect a failure during persistence separately

The `createBulk` function in the [persistence router](https://github.com/takahiro-saeki/circle-hub/blob/a34608c611ded6549c1176a7977e68e1bc62a8db/apps/web/src/server/api/routers/schedule.ts) assigns a new UUID to every row and inserts rows sequentially in chunks of 6. The inspected function has no import request identifier or branch that reconciles previously successful rows.

I extracted that function body and replaced external dependencies, including authorization checks and database writes, with substitutes. The test submitted 7 rows, failed only the second insert, and then submitted the same 7 rows again.

| Point in the test | Rows retained in memory | Distinct dates |
| --- | ---: | ---: |
| The first 6 rows succeed; the next insert fails | 6 | 6 |
| The same 7 rows are submitted again | 13 | 7 |

The repeated request added 7 rows to the 6 retained before failure. Because it generated new UUIDs, all 13 row IDs differed in this test.

This exercises the actual function's control flow against an in-memory database substitute that retains successful inserts. It did not connect to D1, interrupt a real network connection, or resend through the app. The table is not a measurement of D1's behavior during a failure.

It still demonstrates why disabling a form button while a request is pending does not identify this repeated request. Deciding what to resend after a partial failure remains a persistence concern.

## Other boundaries need more than a success count

The experiment covered 8 cases across parsing, form application, and persistence. Other cases checked full-width digit and Japanese hour notation normalization, an invalid date, a reversed time range, a warning for a missing location, and the item limit.

| Input or condition | Result |
| --- | --- |
| Full-width date and Japanese notation equivalent to 18:30 through 21:00 | Normalized to 18:30 and 21:00 |
| A nonexistent date | invalid_date |
| End time before start time | invalid_time_range |
| Only the location is missing | Successful row with a location_missing warning |
| The same valid line repeated 51 times | 50 successful rows; the remainder has limit_exceeded |

The limit is checked against successful rows. Total input lines, including invalid ones, and candidate rows for persistence are different counts.

These tests do not cover every notation or date combination. Further input-boundary tests could examine, for example, whether the extraction regular expressions validate a whole token or can match part of another string.

## Making repeated imports an explicit design requirement

Possible improvements include fixing the parsing reference date, telling users when form contents will be replaced, and recognizing retries at persistence time. None of these changes was applied to the source repository during this work.

For persistence, an import-level key and row identifiers handled by the server could distinguish a repeated operation from new input. A design allowing partial success should report successful rows; a design requiring all rows to succeed together needs that guarantee verified against the selected database. It also needs a rule for receiving different content under the same key.

Simply deleting rows with matching times and locations could remove intentionally distinct schedules that happen to share those values. Define what counts as one import operation before treating apparent duplicates as the same schedule.
