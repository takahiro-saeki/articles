---
title: "Regenerate a 33-event bilingual review table: matching event counts can still hide missing dialogue"
published: false
tags: gamedev, godot, testing, javascript
canonical_url: null
---

VOLT NOMAD has a bilingual catalogue of 33 story events and a script that produces a Markdown proofreading table. Regenerating the table from a fixed revision yielded 33 events and 101 dialogue rows. Adding a line break inside a function call also reproduced a missing dialogue row while the event count remained unchanged.

Compare the review table with the data read by the game, alongside its reported count of 33 events.

## Identify the game source and the review table's role

The subject is commit `f074703` in `game-jam-lab`. [story_catalog.gd](https://github.com/takahiro-saeki/game-jam-lab/blob/f074703848586828b6a5acc0e465ccdd2c0d5244/events/2026-ai-browser-game-jam-4/godot/games/charge_clicker/story_catalog.gd) contains event IDs, Japanese and English titles and contexts, speakers, and dialogue. Its `line(...)` format places both languages in one entry.

[export-dialogue-review.mjs](https://github.com/takahiro-saeki/game-jam-lab/blob/f074703848586828b6a5acc0e465ccdd2c0d5244/events/2026-ai-browser-game-jam-4/tools/export-dialogue-review.mjs) reads that catalogue and the main game code to generate `docs/VOLT_NOMAD_TEXT_REVIEW.md`. Editing the proofreading table does not automatically update the game. GDScript remains the authoritative source to change.

Run the generator from the event directory:

```sh
node tools/export-dialogue-review.mjs
```

For this investigation, the necessary sources were extracted from the fixed commit into a temporary directory. The original worktree and existing generated documents were left unchanged.

## Compare regex output with the actual Godot data

On September 11, 2026, the original generator ran with Node.js 24.15.0. As an independent comparison source, a Godot 4.6.2 headless run loaded the original catalogue and exported its `EVENTS` data to JSON.

| Checked content | Result |
| --- | ---: |
| Story events | 33 |
| Dialogue rows in story events | 101 |
| Combat sections for short communications | 12 |
| Dialogue rows in the short-communications table | 33 |

For the 33 events, the IDs, Japanese and English titles and contexts, and every role, speaker, and text field in the 101 rows matched the proofreading table. The comparison applied the generator's pipe escaping and newline-to-`<br>` conversion.

The 12 combat sections and their 33 rows are counts from the generated table. They are separate from the 101 story-catalogue rows and were not compared through the same Godot data export. Those scopes should not be conflated.

## Test whether catalogue validation detects missing and duplicate values

The original `validate()` checks duplicate event IDs and required values such as titles, contexts, and dialogue text. Executing that implementation in Godot produced 0 errors for the fixed revision.

The following 3 changes were then made only in memory. Each produced 1 error:

- Append a copy of an event to duplicate its ID.
- Empty the English text of the first dialogue line.
- Empty the first event's English title.

The original data was restored after each condition. The game's authoritative source was not damaged to run these tests.

This validation checks presence and uniqueness. It cannot decide whether translation meaning, voice, or foreshadowing is correct. A table placing both languages under the same event ID supports that human review.

## A semantically neutral line break removed a review row

The generator uses a regular expression that expects each `line(...)` call to occupy one source line. A line break was inserted partway through the arguments of the first call.

Godot read exactly the same catalogue data as before, and the original validation still passed. The regenerated story table nevertheless shrank from 101 rows to 100. The event ID remained, so the heading's count of 33 events did not detect the omission.

| Observation point | After the line break |
| --- | --- |
| Data read by Godot | Identical to the original |
| Catalogue validation | Passes |
| Event headings in the review table | 33 |
| Dialogue rows in the review table | 100 |

A successful generator exit therefore does not guarantee complete extraction. One option is to retain comparison of every row against the current data. Another future design could generate the table from structured data exported by Godot. The latter was not implemented in the product for this article.

## Separate text agreement from checking the game screen

The [story design document](https://github.com/takahiro-saeki/game-jam-lab/blob/f074703848586828b6a5acc0e465ccdd2c0d5244/events/2026-ai-browser-game-jam-4/docs/VOLT_NOMAD_STORY_EVENTS.md) and game code provide a development-build Story Lab, the player's Story Log, and an all-events view for local Web builds. The `story_archive=all` branch checks the local host and disables game-progress persistence before opening the archive.

These are entry points for checking English wrapping, language switching, advancing and skipping, and unrecovered-event visibility on screen. This investigation executed catalogue and table comparisons. It did not launch the entire game, export a Web release, or visually inspect all 33 events. Reading the persistence guard does not prove that saves remain unchanged in a real browser.

The [reproduction and comparison code](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/game-records-batch12.py) retains the original-data check, 3 validation mutations, and the extraction omission caused by a line break. Before reviewing meaning and presentation, check that the table contains the full text.
