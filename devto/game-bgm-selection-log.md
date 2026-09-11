---
title: "Audit a game soundtrack by selection records, playback slots, and actual files"
published: false
tags: [gamedev, godot, audio, ai]
canonical_url: https://zenn.dev/hirodeath/articles/game-bgm-selection-log
---

Soundtrack candidates, selected compositions, stored files, and playback assignments gradually diverge. Replacing map music can leave the old file in storage, while two scenes may share one recording. “There are 18 tracks” does not explain what was counted.

Comparing VOLT NOMAD's production notes with its code found 18 BGM slots referring to 17 distinct audio files. Including the victory jingle makes 18 referenced files. The audio directory contains 19.

This article follows selection records through to playback assignments. The source is `game-jam-lab` at `f074703`, inspected on September 11, 2026. No listening comparison or music regeneration was performed.

## Separate selection reasons from implemented assignments

The [music production brief](https://github.com/takahiro-saeki/game-jam-lab/blob/f074703848586828b6a5acc0e465ccdd2c0d5244/events/2026-ai-browser-game-jam-4/docs/SUNO_MUSIC_BRIEF.md) records purpose, title, Suno song ID, the selected A/B candidate, and the game file.

The enemy-specific expansion notes say that some initial candidates were too short and were removed from consideration. Tracks were regenerated with a specified duration, followed by another attempt for candidates that still ended early. The records identify an initial Relay Hydra A at 1:54 and Grid Leech A at 2:34.

Those durations are historical production records. This investigation did not retrieve and measure every Suno candidate again. They support the narrower observation that duration was a selection criterion at that stage.

The history also progresses from candidate records in `5ab837b` to enemy-specific music in `290d302`. That helps distinguish stored candidates from music that reached the implementation.

## Follow the name to the playback key

The [game's music code](https://github.com/takahiro-saeki/game-jam-lab/blob/f074703848586828b6a5acc0e465ccdd2c0d5244/events/2026-ai-browser-game-jam-4/godot/games/charge_clicker/charge_clicker.gd) contains two dictionaries with different roles.

`EncounterBGMKeys` maps encounter or form IDs to BGM keys. `BGMStreams` maps those keys to audio files. A few inspected relationships are:

| Encounter ID | BGM key | Referenced file |
| --- | --- | --- |
| gearmaw | hunt | piston_hunt_loop.ogg |
| vaultback | vaultback | blue_vault_pulse.ogg |
| phase_mantis | phase_mantis | critical_parallax.ogg |
| prime_current_form_1 | prime_current_form_1 | prime_current_crownless_protocol.mp3 |

Following both stages avoids mistaking a differently named key for an unused composition. Gearmaw's dedicated track uses the generic key `hunt`.

`desired_bgm_key()` makes the actual selection. The open title or gallery, ordinary or boss combat, and the final boss form affect its result. A dictionary entry alone does not establish that the intended scene can reach it. The selection branches were inspected too, but every scene was not played through during this investigation.

## 18 slots, 17 BGM files, 18 files with the jingle

The automated count of dictionaries and Git-tracked audio produced:

| Counted object | Count |
| --- | ---: |
| Keys in `BGMStreams` | 18 |
| Distinct audio files referenced by those keys | 17 |
| Referenced files including the separate victory jingle | 18 |
| Stored files in the target audio directory | 19 |

Both `singularity` and `ending_world` use `arch_singularity.ogg`. Separate scene slots do not create two compositions.

The previous map track, `subterranean_hunt.ogg`, remains stored but is absent from the inspected BGM dictionary's references. The current map key points to `six_core_descent.mp3`. This reflects retaining an earlier track after replacement; the investigation did not delete the unreferenced file.

The production brief's “18 tracks” corresponds to distinct BGM files plus the victory jingle. Keeping separate counts for keys, files, and stored material helps detect duplicates and omissions during cleanup or a port.

## Compare measured file duration with rounded production notes

ffprobe inspected 19 audio files extracted from Git. Every audio stream was 48 kHz with 2 channels. Selected file durations were:

| File | ffprobe duration in seconds |
| --- | ---: |
| blue_vault_pulse.ogg | 180.040000 |
| cascade_trinity.ogg | 179.880000 |
| critical_parallax.ogg | 179.800000 |
| nomad_victory_signal.mp3 | 12.973500 |

“3:00” and “0:13” in the production table are rounded descriptions. They are not precise loop points or stop times. The values above are also file durations reported by ffprobe, not listening measurements of the first and last audible sounds.

The brief records mastering the initial tracks to approximately -18 LUFS. However, the original WAV files are not in this repository. This investigation neither reproduced that mastering pass nor established that every current track has equal loudness. Later MP3 additions were not assumed to have received the same processing.

## Record loop configuration separately from listening approval

The implementation enables looping for Ogg and MP3 when switching BGM:

```gdscript
if next_stream is AudioStreamOggVorbis:
	(next_stream as AudioStreamOggVorbis).loop = true
elif next_stream is AudioStreamMP3:
	(next_stream as AudioStreamMP3).loop = true
```

[Godot's AudioStreamMP3 reference](https://docs.godotengine.org/en/stable/classes/class_audiostreammp3.html) documents its `loop` property. The code requests repetition, but musical continuity between the end and the beginning is a separate question. This investigation did not listen for seam noise, silence, or beat misalignment.

Two AudioStreamPlayer instances handle scene changes with a configured crossfade of `0.85` seconds. The short victory jingle has a separate player and does not enter the full-track BGM loop. These observations describe playback code, not measured listening comfort or mix quality.

## Keep enough evidence for the next replacement

The [verification script](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/game-input-media-evidence.py) reads dictionaries and audio from the fixed commit and records reference existence, counts, SHA-256 hashes, and ffprobe data. The [saved results](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/production/2026-09/batch-05/game-media.json) used ffprobe `9.0.1`. No audio conversion or upload took place.

For the next replacement, the same record can hold the candidate ID, selection reason, game key, file, and the extent of listening verification. The record then identifies the playback destination and any checks still pending.
