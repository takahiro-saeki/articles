---
title: "Recording generated-asset provenance, originals, and selection decisions"
published: false
tags: [ai, gamedev, documentation, tooling]
canonical_url: https://zenn.dev/hirodeath/articles/generated-asset-provenance-decisions
---

Generating assets with AI also produces candidates that never get used. Saving only the images makes it harder to reconstruct the references used, whether a person approved a candidate, and which processed file the game actually loads.

A stable candidate ID can connect the original, generation parameters, reviews, and code references while keeping those checks separate. This article examines VOLT NOMAD's asset records, including a place where the recorded states do not agree.

The investigation took place on September 11, 2026, against `game-jam-lab` commit `f074703`. It did not call generation APIs or create new images.

## A provenance document and a candidate-level manifest

The repository contains [ASSET_PROVENANCE.md](https://github.com/takahiro-saeki/game-jam-lab/blob/f074703848586828b6a5acc0e465ccdd2c0d5244/events/2026-ai-browser-game-jam-4/docs/ASSET_PROVENANCE.md), which explains the production process, and [review-manifest.json](https://github.com/takahiro-saeki/game-jam-lab/blob/f074703848586828b6a5acc0e465ccdd2c0d5244/events/2026-ai-browser-game-jam-4/tools/art-review/data/review-manifest.json), which records individual candidates.

The document describes where generation and processing were used. The manifest groups candidates into generation batches and stores information such as:

| Record | What it lets you inspect |
| --- | --- |
| `id`, `file` | Candidate identity and the original file |
| `prompt`, `model`, dimensions, `seed` | Recorded generation parameters |
| `referenceFile`, where present | The reference image |
| `generation` | Generation status, timestamp, usage, and errors |
| `codexReview` | Recommendations and concerns |
| `humanReview` | Human decisions, ratings, and review timestamps |

This structure separates successful generation from a selection decision. Some candidates have a `null` seed, so the existence of a manifest does not establish that an identical image can be regenerated.

## Follow one candidate from its original into the game

Consider `final-fallen-machine-seraph-v9-c`. A reduced excerpt of its recorded values is:

```json
{
  "id": "final-fallen-machine-seraph-v9-c",
  "model": "pixen",
  "seed": null,
  "file": "source/enemy/final-fallen-machine-seraph-v9-c.png",
  "codexReview": {
    "status": "recommended",
    "score": 98
  },
  "humanReview": {
    "status": "approved",
    "rating": 5
  }
}
```

The full record also includes the generation timestamp, prompt, recommendation rationale, and human review notes. The values 98 and 5 are ratings stored in the manifest, not image-quality or performance measurements made in this investigation.

The provenance document describes removing the original's background to produce a cutout for the game. In the [game code](https://github.com/takahiro-saeki/game-jam-lab/blob/f074703848586828b6a5acc0e465ccdd2c0d5244/events/2026-ai-browser-game-jam-4/godot/games/charge_clicker/charge_clicker.gd), `prime_current_form_3` preloads `final-fallen-machine-seraph-v9-c-cutout.png`.

The manifest's `file` therefore differs from the file loaded by the game. SHA-256 hashes of the original and cutout at the fixed commit also confirm different byte contents. A hash difference does not explain the transformation, but the document and code reference together establish a traceable relationship between original and processed file.

## Counting the manifest exposes different states

The [inspection script](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/game-submission-evidence.mjs) reads the manifest and file listing from the fixed commit. On Node.js `v24.15.0`, it found:

- 30 batches containing 107 candidates.
- Unique candidate IDs and a file present in the Git tree for every one of the 107 `file` entries.
- `generation.status` set to `generated` for all 107 candidates.
- Human-review states of `approved` for 35, `hold` for 13, `rejected` for 3, and `unreviewed` for 56 candidates.

These are checks of records and original-file presence. They are not a visual evaluation of 107 images or evidence that all 107 entered the game.

The following 3 defeat-effect candidates were preloaded by the game code while their `humanReview.status` remained `unreviewed`:

```text
Fracture: defeat-vfx-core-fracture-v12-a
Halo: defeat-vfx-voltage-halo-v12-b
Shards: defeat-vfx-machine-shards-v12-c
```

An `approved` filter alone therefore cannot produce the complete list of implementation references. However, an unreviewed record does not prove that no person ever looked at an image. The supported finding is narrower: human approval was not recorded in the manifest at that revision, and a code reference existed.

## Cross-check selection and integration separately

The repository already separates generation status, AI recommendations, and human decisions. The inspected manifest did not provide a uniform per-candidate structure recording the runtime file through which each candidate was integrated.

One possible addition would record usage separately, rather than forcing every review status to `approved`:

```text
Candidate ID
  ├ Original path and hash
  ├ Human decision and rationale
  └ Usage
      ├ Processed-file path and hash
      ├ Document or script describing the transformation
      └ Code commit in which the reference was verified
```

This is a future design proposal. It was not added to the existing manifest.

An empty usage record should not immediately mean “unused”; usage might simply be undocumented. Similarly, finding a code reference does not prove that the asset always appears during normal play. This investigation performed static reference checks, not a fresh visual run of the game.

## Use the records when replacing an asset

To replace the final-form image, first identify the candidate and original, read the selection rationale, and follow the processed file into the code. Overwriting only the original may leave the display unchanged if the game still references the cutout.

Replacing only the processed file can make its relationship with the original unclear. Decide whether the new file is a new candidate or another derivative of the same candidate, then record that relationship.

This investigation could trace candidate IDs to originals and reviews, then use the document and code to locate processed-file usage. It also found examples where human approval records and code references differed.

Keep generation, judgment, and usage as separate records rather than reducing them to a single “adopted” flag. When replacing an asset, use those records to check the relationship between its original and its usage.
