---
title: "Putting Codex into a Game Production Pipeline, from Godot Implementation to Release Checks"
tags: ai, godot, gamedev, testing
canonical_url: https://zenn.dev/hirodeath/articles/volt-nomad-codex-production
published: false
---

This article is an English version of my original Japanese post.

Using AI to generate a piece of code does not necessarily move a game much closer to release.

A game also needs planning, assets, balancing, tests, a store page, and often a trailer. Speeding up one task helps, but information can still break between stages and leave a person reconnecting everything by hand.

For [VOLT NOMAD](https://tsgamestudio.itch.io/volt-nomad), I used Codex across the production flow instead of treating it as a one-off code generator. From August 1 to the release candidate, the project accumulated 53 commits. The game grew to six machine beasts, five gear trees with 86 nodes and 317 ranks, plus 33 bilingual story events.

The useful part was not one clever prompt. It was keeping the stages connected.

## Keep Decisions in the Repository

I did not begin with one enormous final specification.

The production plan defined three quality gates: 30 seconds, 5 minutes, and 20 minutes. Each had observable completion criteria. For the first gate, the player should understand the input within five seconds, afford an upgrade within 30 seconds, and still want to test another upgrade after a few minutes.

Codex used those documents while implementing, testing, and updating progress. When the design changed, I updated the decision log rather than changing only the code.

That made it possible to recover not just the current state, but the reason behind it. Important decisions did not live only in chat history.

## Separate Game State from the Screen

Before expanding the test suite, I separated progression state from rendering and input.

Rules for attacks, CHARGE, purchases, campaign progress, and saves could advance without opening the full interface. The UI sent input to that state and rendered the result.

This made deterministic simulations possible. A test could attack at a fixed rate, buy affordable skills, and complete the campaign. I did not have to click for half an hour after every balance change.

I did not present the automated completion time as human playtime. A simulation does not read dialogue, learn the screen, or hesitate between upgrades. Machine benchmarks and player-facing estimates stayed separate.

## Run All 1,440 Campaign Routes

Players can defeat six machine beasts in any order. Six beasts have 720 possible orders, and the normal route includes one of two bosses. That creates 1,440 paths.

Manual verification was not realistic. The release audit drove every route through the normal ending, later campaign, final encounters, credits, and save restoration.

```bash
godot --headless --path godot \
  -s res://tests/release_audit.gd
```

The audit did not try to decide whether the game was fun. It checked concrete failures:

- Does every order remain completable?
- Are the correct beasts left after the normal ending?
- Can progression and upgrades be restored from a save?
- Are all 33 English and Japanese story events present?
- Can the packaged build reach effects, audio, and final credits?

The machine handled combinations and consistency. I could spend more time on whether the first hit felt good, whether the next purchase was visible, and where play turned into repetition.

## Select Generated Assets Inside the Game

PixelLab produced 92 visual candidates, but I did not treat generation as approval.

I kept source files, recorded review states, and switched candidates inside Godot under the same background, scale, and UI. An image can look strong by itself and fail at 24 pixels, or cover an enemy health bar once placed in combat.

Music followed the same process. I listened for interference with attack sounds, awkward loop points, and whether a 0.85-second transition felt natural in context. The released game uses 18 original tracks.

Codex helped organize candidates, validate files, and integrate them. I made the final selection by playing the game.

## Put Submission Work in the Repository Too

Work outside the executable can consume the last days of a jam.

I stored the itch.io description, controls, AI disclosure, screenshot order, tags, and release checklist beside the project. The repository also held the Web ZIP build procedure and a dedicated export that opened directly on the VOLT NOMAD title screen.

This reduced last-minute gaps such as a complete game with no submission copy, or inconsistent AI disclosures across pages. The production pipeline did not stop when the build passed. It continued until another person could open the page and play.

## The Human Role Moved Rather Than Disappeared

Using Codex across more stages did not remove the human workload. It changed where I spent it.

Faster implementation meant I could play more alternatives and reject them. More generated candidates meant more in-game comparison. Automated audits freed time to look for discomfort that numbers could not identify.

Codex contributed speed, records, and coverage. I played, described what felt wrong, selected and rejected work, and decided when the game was ready.

That division applies beyond game development. Instead of handing AI one isolated task, let the same recorded decisions flow through planning, implementation, verification, and release. That is when code generation speed begins to reach a finished product.

The [source and production documents are available on GitHub](https://github.com/takahiro-saeki/game-jam-lab/tree/main/events/2026-ai-browser-game-jam-4).

