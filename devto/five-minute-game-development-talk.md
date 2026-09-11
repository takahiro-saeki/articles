---
title: "Editing a VOLT NOMAD talk to five minutes: allocate time to decisions"
published: false
description: "A review of real game-development slides turns a broad production story into a timed proposal without inventing a successful presentation."
tags: [gamedev, speaking, ai, productivity]
canonical_url: "https://zenn.dev/hirodeath/articles/five-minute-game-development-talk"
---

A game-development talk can easily grow to include planning, rejected ideas, generated code, artwork, music, tests, and submission preparation. The initial VOLT NOMAD lightning-talk deck had material for all of them.

A five-minute tour of every production stage can obscure what listeners should change in their next project. This article reviews the existing materials and proposes **allocating time to examples that directly support the decision listeners should take away**. It does not report audience reactions or a verified five-minute delivery.

## The initial draft had 9 slides; revisions added introductions

The file `volt-nomad-lightning-talk-draft.pptx`, dated August 27, 2026, contains 9 slides: title, biography, today's topic, game introduction, Game Jam, prototypes, Codex, asset production, and the takeaway.

A visual revision contains 10 slides, and a version adding personal service introductions contains 11. Extracting and comparing their text showed that the central production topics stayed largely the same while the introduction grew. It has not been established which, if any, was the final deck used on stage.

Adding a slide therefore does more than make the same explanation easier to see. Time spent on the biography, topic declaration, and game explanation competes with concrete examples in the main story.

The useful check is overlapping roles, rather than a universal slide limit. This deck could introduce the game and the talk's purpose over a gameplay image instead of separately explaining the title, today's topic, and game introduction.

## Keep the decision to select, reject, and return feedback to production

The original outline says that AI expanded the range of production work while the Game Jam's deadline and publication destination helped make completion possible. The initial ending also places deadlines, AI, and human decisions together.

From that material, the proposed five-minute question is: "When AI can perform more production work, what must a person keep deciding?" The answer is to compare working candidates, choose what remains, and feed that choice back into implementation. This is an editorial proposal, not a conclusion verified with an audience.

The repository contains a [prototype-retirement change](https://github.com/takahiro-saeki/game-jam-lab/commit/51984887e2b2be66c1330a3ade8d82a9392532b6) dated August 9, 2026. It removed the earlier launcher from the current game. The [pinned README](https://github.com/takahiro-saeki/game-jam-lab/blob/f074703848586828b6a5acc0e465ccdd2c0d5244/events/2026-ai-browser-game-jam-4/README.md) likewise states that the retired launcher is not included in the current game.

That offers an example of removing already implemented work from a release, rather than listing everything AI could produce. A Git change alone does not reveal what the creator felt or why at that moment. Reasons should come from the production documents where they are recorded.

## Assign examples to a 270-second main talk

The following allocation is a new proposal, not a measurement of speaking speed. It gives the main talk 270 seconds and leaves 30 seconds for transitions or corrections.

| Elapsed time | Allocation | Point to explain | Material to show |
| --- | ---: | --- | --- |
| 0:00 to 0:25 | 25 seconds | The game and the production decision being discussed | A finished game screen |
| 0:25 to 1:10 | 45 seconds | Working with a deadline and publication destination | The Game Jam window and submission destination |
| 1:10 to 2:25 | 75 seconds | Keeping or removing an implemented direction | Earlier prototypes and the current game |
| 2:25 to 3:40 | 75 seconds | Returning comparisons to the next implementation | Asset candidates and their appearance in the game |
| 3:40 to 4:30 | 50 seconds | Where to make the same decision in the next project | A sentence connecting selection and the deadline |
| 4:30 to 5:00 | 30 seconds | Buffer | No new topic added |

The arithmetic was also checked in code. This validates the script's time budget, not its spoken duration.

```python
segments = [25, 45, 75, 75, 50]
buffer = 30
assert sum(segments) == 270
assert sum(segments) + buffer == 300
```

The two main examples serve different purposes. Prototypes show choosing a direction by removing implemented alternatives. Assets show reviewing appearance within the chosen game and revisiting acceptance decisions. Tool introductions should occupy only the space needed to explain those decisions.

## Preserve technical detail as accessible supporting material

VOLT NOMAD has bilingual text, multiple input methods, an asset ledger, route verification, and submission images and videos. Its [public page](https://tsgamestudio.itch.io/volt-nomad) describes the game and AI involvement. None of that requires explaining every system during the main talk.

Reading Codex's roles from planning through submission would overlap with the subsequent asset-selection story. The proposal instead focuses on one exchange: produce candidates, integrate them, and return feedback about what does not work. Controls and automated-test implementation can move to supporting material.

Supporting material remains useful. It lets listeners follow a repository or article when they want to reproduce the work. Omitting a detail from the main talk is not a judgment that the technical work lacks value.

An interactive demonstration would need time allocated in advance. This proposal does not spend its 30-second buffer on an unplanned demo or another topic.

## Preserve the meaning behind prominent numbers

The initial deck includes 53 commits, 1,440 routes, 92 asset candidates, and 18 tracks. Those figures attract attention, but explaining their units and scope also takes time.

The 53-commit count was reproduced from the pinned Git history by selecting the event's path and the period from August 1 through August 12, 2026, in Japan time. A commit count does not measure production hours or time saved by AI. It cannot provide numerical evidence of a speedup.

Candidate totals depend on the ledger scope, while a music count needs to distinguish assigned slots from distinct files. Rather than repeating draft figures as current totals, notes checked against the [provenance document](https://github.com/takahiro-saeki/game-jam-lab/blob/f074703848586828b6a5acc0e465ccdd2c0d5244/events/2026-ai-browser-game-jam-4/docs/ASSET_PROVENANCE.md) and ledger fit better in the supporting material for this particular talk.

Every number need not be removed. A pair of images that explains an acceptance decision can carry the example without establishing the scale of all production. This proposal reallocates time from proving quantity to showing a decision's before and after.

## The remaining check is actual delivery time

The completed checks cover slide counts and content, correspondence with the production repository, and the allocation total. They do not cover spoken delivery, transitions at the venue, or audience comprehension.

The next check is to deliver the talk with its intended screens and record the actual time for each segment. If a segment overruns, reconsider whether its example directly supports the intended decision before speaking faster. After shortening the deck, check that the retained examples can be explained within the five-minute limit.
