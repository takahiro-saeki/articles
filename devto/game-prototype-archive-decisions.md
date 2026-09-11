---
title: "Archive retired game prototypes while checking what the current build actually launches"
published: false
tags: gamedev, git, godot
canonical_url: null
---

When retaining game prototypes that were not selected, distinguish code preserved in Git from games playable through the current application. In the VOLT NOMAD repository, old prototype code and images moved into an archive while startup was changed to open VOLT NOMAD directly.

Comparing the move commit confirms that 14 files retained their contents. An older prototype list nevertheless remained in the root README. The current feature list needs evidence beyond the archive contents.

## Count what was retained from the Git diff

The subject is `events/2026-ai-browser-game-jam-4/` in `game-jam-lab`. On September 11, 2026, the [move commit 5198488](https://github.com/takahiro-saeki/game-jam-lab/commit/51984887e2b2be66c1330a3ade8d82a9392532b6), dated August 9, 2026, was compared with the later fixed revision `f074703`.

From the repository root, inspect this diff:

```sh
git diff-tree -r --name-status -M 5198488^ 5198488
```

The following 14 files appeared as `R100` moves into `archive/retired-prototypes/`:

| Type | File count |
| --- | ---: |
| Prototype GDScript files | 3 |
| GDScript UID files | 3 |
| Key-art images | 4 |
| Image import files | 4 |

The 3 scripts belong to `capacitor_defense`, `chargeback`, and `zero_percent_city`. Alongside the rename detection described in the [Git diff reference](https://git-scm.com/docs/git-diff), each file was compared byte for byte before the move, immediately after it, and at `f074703`. All matched.

## The archive sits outside the Godot project boundary

The fixed revision has this arrangement:

```text
events/2026-ai-browser-game-jam-4/
  archive/retired-prototypes/games/
    capacitor_defense/
    chargeback/
    zero_percent_city/
  godot/
    project.godot
    main.gd
    games/charge_clicker/
```

The [Godot filesystem documentation](https://docs.godotengine.org/en/stable/tutorials/scripting/filesystem.html) defines the project root by the location of `project.godot`; `res://` points there as well. In this layout, the archive is outside the current Godot project.

The entry-point [main.gd](https://github.com/takahiro-saeki/game-jam-lab/blob/f074703848586828b6a5acc0e465ccdd2c0d5244/events/2026-ai-browser-game-jam-4/godot/main.gd) preloads `ChargeClicker` and defers a call to `launch_project_charge`. None of the 3 retired prototype names appears in that entry point. The event README also describes direct startup into VOLT NOMAD without the retired launcher.

This verification covers layout, startup code, and matching documentation. Exported PCK files were not compared, so it provides no measurement of how many MB the distribution became smaller.

## Preserved files do not guarantee a standalone restart

The archive retains source, images, and sidecar files. It was not verified that simply opening that directory in Godot launches the old prototypes. Their `res://` references, shared components, scenes, and input settings may depend on the original arrangement.

Trying one again requires reading the saved commit and dependencies, then preparing a verification project separately from the current startup configuration. The old prototypes were neither ported nor rebuilt in this investigation.

"Available for later reference" has several levels. Byte equality verifies retained code for comparison. Preserving an executable environment is a separate condition that requires a startup test.

## The event README and root README disagree

At `f074703`, the [event README](https://github.com/takahiro-saeki/game-jam-lab/blob/f074703848586828b6a5acc0e465ccdd2c0d5244/events/2026-ai-browser-game-jam-4/README.md) identifies VOLT NOMAD as the current game. The repository's root README still lists the 3 old prototypes alongside PROJECT CHARGE and describes an event containing multiple prototypes.

This documentation drift was observed during the inspection. Reporting that the application currently offers 4 selectable games based only on the root README would contradict its startup code. Check the current entry point against event-specific documentation at the same commit, rather than relying on directory names or an old introduction.

A future cleanup could point the root README toward the current game and identify the prototypes as retained material. The source repository's README was not edited for this article.

## Separate the visible decision from undocumented reasons

The move commit's message describes retiring the prototype launcher. Its diff shows that the current entry point was narrowed to one game while the older prototypes were retained. That provides separate starting points for reading the current implementation and comparing earlier ideas.

The individual evaluations and future reuse plans are not recorded in the diff. It would be unfounded to supply reasons such as poor gameplay or implementation difficulty.

The [14-file comparison and entry-point verifier](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/game-records-batch12.py) is saved. Explaining an archive requires checking what was retained, what currently starts, and what would be required to rerun it. Those checks prevent treating the archive as either an active feature or a complete restoration environment.
