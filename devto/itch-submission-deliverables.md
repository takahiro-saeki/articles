---
title: "Beyond the game build: checking itch.io submission copy and image files"
published: false
tags: [gamedev, indie, godot, documentation]
canonical_url: https://zenn.dev/hirodeath/articles/itch-submission-deliverables
---

Exporting a Web build does not finish a game's submission page. Players may still lack instructions, the screenshot order may be undecided, or the supported-device description may promise more than has been tested. Inspecting the game code alone will not reveal all of these problems.

Treat the submission as a bundle containing the game and the explanations and images needed before playing. Using VOLT NOMAD's submission materials, this article examines what exists and what a file inspection revealed.

The investigation took place on September 11, 2026, against fixed `game-jam-lab` commit `f074703`. It did not submit a new build or change publication settings.

## Read the submission kit in the order players make decisions

The repository's [ITCH_SUBMISSION.md](https://github.com/takahiro-saeki/game-jam-lab/blob/f074703848586828b6a5acc0e465ccdd2c0d5244/events/2026-ai-browser-game-jam-4/docs/ITCH_SUBMISSION.md) collects page fields, short and long descriptions, controls, AI-use disclosure, and screenshot order.

Rather than reading it only as text to paste into a form, map it to a first-time visitor's decisions:

| Player's question | Relevant submission material | Content in this example |
| --- | --- | --- |
| What kind of game is this? | Short description and first image | Fight machine beasts and spend CHARGE on upgrades |
| Can I start on my setup? | Project type, display, compatibility | HTML, 1280 × 720, fullscreen |
| What should I press first? | Controls | Select, attack, confirm, and return |
| What opens up as I play? | Long description and later images | Gear trees, boss fights, and archives |
| Which tools were used to make it? | AI-use and production disclosure | Separate explanations for code, images, music, and other work |

This reading prioritizes what someone needs to start, ahead of listing every feature. Its effect on actual visitor drop-off was not measured.

## Separate implemented inputs from tested devices

The controls list includes mouse and touch selection and attacks, Space and controller A for manual commands, arrow keys and the D-pad for navigation, and confirmation and return actions. It also describes language and music controls.

The page-setting instructions separately say to leave `Mobile friendly` unchecked until a real-phone pass is complete. The presence of touch instructions is not treated as proof that the entire game works on a phone.

That distinction is useful during submission review. Having code that accepts an input, making controls discoverable on a small display, and reaching the end on that device are different checks. Compatibility copy should reflect the checks actually completed.

This investigation inspected the document and files. It did not retest the controls on each controller or smartphone. “Listed in the controls table” should not become “verified on the device” during editing.

## Check image contents as well as their order

The kit proposes 6 screenshots: the title screen, combat, gear trees, ARCH SINGULARITY, the archive, and PRIME CURRENT. The final image reveals later content and is optional.

The files were extracted from the fixed commit and their headers inspected for format and dimensions. This revealed a mismatch:

| Files | Filename extension | Actual format | Dimensions |
| --- | --- | --- | --- |
| The 6 images from `01-title-screen` through `06-prime-current` | `.png` | JPEG | All 1280 × 720 |
| `cover-630x500.png` | `.png` | PNG | 630 × 500 |
| `cover-630x500-key-art.png` | `.png` | PNG | 630 × 500 |

All 6 screenshots existed, but none was a PNG as its name suggested. Header parsing on Node.js `v24.15.0` and the macOS `file` command agreed on the formats. The [inspection code](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/game-submission-evidence.mjs) reads from a fixed commit without touching ongoing working files.

There is no evidence here that the mismatch caused an itch.io upload failure. It does identify something to correct before handing the files to processing or validation that expects PNGs. A repair could rename them to match their contents or re-export them in the intended format, followed by updating document references. The original assets were not modified for this article.

```text
Image preparation checks
- Do the files named in the document exist?
- Do their actual formats and dimensions match expectations?
- Are they ordered as intended for the submission page?
- Should images revealing later content be included?
```

The record of which images were selected can be kept separately from submission-file validation. Merely finding images in a folder misses the format mismatch.

## Describe AI use by production stage

The submission material separates the production methods for code, pixel art, cinematic images, music, and sound effects. These include Codex, PixelLab, OpenAI image generation, Suno, and procedural sound effects in Godot.

This is more specific than a single statement that AI was used: readers can tell which tools relate to which outputs. It also allows generation to be described separately from choosing the direction and selecting results.

When updating the disclosure, compare it with the provenance documents and records for assets actually selected. That avoids listing an experimental service as a production tool or implying that every generated image entered the game. This investigation verified the categories in the submission document; it did not review each service's terms of use.

## Align Web-export requirements with the submission document

The [itch.io HTML5 guide](https://itch.io/docs/creators/html5) describes including `index.html` and the required files in the ZIP, with correct paths and filename case. Because the game is embedded, the page's display dimensions also need checking.

If the submission document specifies 1280 × 720, verify that the main controls remain visible in that frame before submitting. A valid ZIP does not establish that page copy and display settings are correct. This investigation did not re-export the game or rerun the embedded-display test.

In this example, page copy, controls, disclosure, and image order were documented, and the relevant image files existed. The inspection also found screenshot extensions inconsistent with their contents and an explicit policy to defer the mobile setting until device verification.

A submission checklist should therefore let you compare the written claims with the actual files and test results, alongside checking that the form fields are filled.
