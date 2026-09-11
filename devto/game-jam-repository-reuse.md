---
title: "Reusing a game jam repository starts with event boundaries and explicit export targets"
published: false
description: "Inspecting a Godot jam repository shows which export conventions can carry forward and which game-specific settings still need a deliberate choice."
tags: gamedev, godot, githubactions, programming
canonical_url: https://zenn.dev/hirodeath/articles/game-jam-repository-reuse
---

After a game jam, source code is only part of what is worth keeping. The procedure for building the submission ZIP, the export preset, and the test command are useful material for the next event too.

Keeping an old game and building a reusable library are different amounts of work. An inspection of `game-jam-lab` found an event-based structure containing documents and tools, but not a completed SDK shared by every event.

This article examines a design that leaves room for more events while making the target of each test and export explicit. The inspected version is commit `f074703`, checked on September 11, 2026. Ongoing uncommitted work is not counted as completed functionality.

## Keep the submission's parts together

The relevant parts of the [committed structure](https://github.com/takahiro-saeki/game-jam-lab/tree/f074703848586828b6a5acc0e465ccdd2c0d5244/events/2026-ai-browser-game-jam-4) look like this:

```text
events/
  2026-ai-browser-game-jam-4/
    godot/
      project.godot
      shared/
      tests/
    docs/
    tools/
    submission/
```

This commit tracks one event. The structure is being evaluated as a place to add the next event, not as evidence of completed operations across multiple events.

Keeping the game, design notes, tools, and submission material under the event makes the intended submission traceable from a path. Compared with mixing several games' `project.godot` files and ZIP-building logic at the repository root, it gives the next event a clear home while preserving the previous one.

Copying a folder does not necessarily prepare the next submission, though. The event name, game name, export preset, and publication destination still need checking. Separate storage does not automatically switch those settings.

## Resolve the target from the script's own location

The [itch.io export script](https://github.com/takahiro-saeki/game-jam-lab/blob/f074703848586828b6a5acc0e465ccdd2c0d5244/events/2026-ai-browser-game-jam-4/tools/build-itch-project-charge.sh) derives the event root from its own location, rather than the caller's current working directory:

```bash
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
event_root="$(cd "$script_dir/.." && pwd)"
godot_root="$event_root/godot"
output_dir="$event_root/build/itch/volt-nomad"
archive_path="$event_root/build/itch/volt-nomad-web.zip"
```

It resolves `godot_root` before passing it to `--path`. Output also lives under that event's `build/` directory. Running the script from the repository root or inside the event therefore targets the same project.

This does not make the script ready for the next event without changes. The output name `volt-nomad` and preset `Itch Volt Nomad` remain specific to this game. They need attention when copying the script. Before generalizing the script, make its game-specific values easy to identify.

## Test path resolution and ZIP layout separately

To examine this behavior, the actual script from the fixed commit was extracted into a temporary directory. The event directory was renamed for the fixture, and a small stub replaced the Godot executable.

The stub records its arguments and creates fixture files named `index.html`, `index.js`, `index.pck`, and `index.wasm`. It does not export a game through Godot. The original shell code still creates the ZIP and checks its required files.

| Working directory | Target passed to `--path` | Four files at ZIP root |
| --- | --- | --- |
| Fixture repository root | That event's `godot/` | All present |
| That event's `godot/` | That event's `godot/` | All present |

The script also passed `bash -n`. The [verification code](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/game-jam-layout.mjs) ran with Node.js `v24.15.0`:

```bash
node experiments/article-stock-2026-09/game-jam-layout.mjs ../game-jam-lab
```

This verifies path construction and ZIP layout. Game startup, a successful Web export, and running on itch.io require separate checks. The inspected CI specifies Godot `4.6.2`, but this experiment did not execute Godot.

## Read the scope of `shared/`

The event's `godot/shared/` directory contains files for controller input, palettes, audio settings, and synthesis. They live inside the event. They are not a repository-level common `tools/` directory or a library extracted for use across events.

That scope matters when reusing code in the next game. Code shared within an event can reasonably know the names and settings of that event's games. Moving it elsewhere requires checking dependencies such as input action names and save locations.

A possible next step is to copy the code into the next event and inspect the resulting differences before moving it into a common library. If the game name is the only recurring change, an argument or setting might be enough. If progression logic and assets must also be rewritten, keeping that part inside the event may remain easier to understand.

The evidence for extraction is what two events can use unchanged, not the directory name `shared`. That comparison has not yet been performed here, so there is no measured time saving to report.

## Adding an event does not select it for CI

The [Pages workflow](https://github.com/takahiro-saeki/game-jam-lab/blob/f074703848586828b6a5acc0e465ccdd2c0d5244/.github/workflows/pages.yml) hardcodes `events/2026-ai-browser-game-jam-4/godot` as the `--path` for smoke tests and Web export. It does not discover and run every directory under `events/`.

Adding the next event's folder therefore does not automatically test the next game. The workflow needs an explicit choice of which projects to test, which to publish, and which merely to preserve.

A future design could separate a list of verification targets from a single publication target. Checking older events for syntax or startup problems and deciding whether a new game should replace the published build are separate decisions. This design is not implemented in the inspected commit.

To leave the repository usable for another event, preserve the event's parts and inspect what its scripts and CI point to. In this structure, the export script's relative placement can carry forward. The game-specific output names and the fixed CI target are choices to revisit for the next event.
