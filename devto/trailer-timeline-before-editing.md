---
title: "From 63 seconds to 60: checking a game trailer against its timeline and video files"
published: false
tags: [gamedev, godot, ffmpeg, video]
canonical_url: https://zenn.dev/hirodeath/articles/trailer-timeline-before-editing
---

Even a short game trailer fills up quickly with a title, combat, upgrades, bosses, and a destination to play. Removing a few seconds at the end does not change what viewers encounter first.

VOLT NOMAD's history retains an initial trailer configured for 63 seconds and a second version reorganized around 60 seconds. The change also moved combat to the opening. This article compares the code-defined sequence with the actual video files.

The investigation inspected fixed revisions and Git-tracked MP4 files on September 11, 2026. It did not regenerate the trailer or measure audience retention.

## Combat began at 13 seconds in V1 and at the opening in V2

The [initial capture code](https://github.com/takahiro-saeki/game-jam-lab/blob/bf5c7e7/events/2026-ai-browser-game-jam-4/godot/tools/trailer_capture.gd) at `bf5c7e7` begins with:

| Configured interval | Initial content |
| --- | --- |
| 0.0 to 3.5 seconds | Key art |
| 3.5 to 8.0 seconds | Title screen |
| 8.0 to 13.0 seconds | Route selection |
| 13.0 to 22.0 seconds | Combat |

The [capture code containing V2](https://github.com/takahiro-saeki/game-jam-lab/blob/f074703848586828b6a5acc0e465ccdd2c0d5244/events/2026-ai-browser-game-jam-4/godot/tools/trailer_capture.gd) at `f074703` opens with early combat followed by upgraded combat:

| Configured interval | V2 content |
| --- | --- |
| 0.0 to 4.5 seconds | Initial combat: click, damage, CHARGE |
| 4.5 to 10.0 seconds | Upgraded combat |
| 10.0 to 16.0 seconds | Gear tree |
| 16.0 to 21.0 seconds | Route selection |

The ordering in the code verifies a change toward showing what an action produces at the start. It does not establish an improvement in viewer understanding or view counts.

The useful editing decision is to reconsider which action belongs first before shortening every asset a little.

## Use the interval table to drive capture

V2's `beats` array holds start and end times, a scene ID, captions, and other presentation data. Runtime code chooses the interval from elapsed time:

```gdscript
func beat_index_at(time: float) -> int:
	for index in range(beats.size()):
		if time < float(beats[index].end):
			return index
	return beats.size() - 1
```

Changing intervals configures the game state and presentation for capture. Reaching `DURATION` ends the process.

This function selects intervals by their end times. It does not separately use start times to create empty gaps. If one start differs from the preceding end, the table's description and the execution can disagree.

The verification checked all 11 intervals: the first starts at 0, each meets the preceding interval without a gap or overlap, and the last ends at 60. The unchanged function was also extracted into Godot to verify selection just before and exactly at each boundary. Including the start and end, 22 assertions passed. These checks cover both interval consistency and switching positions.

## Using game rendering does not mean recording ordinary play

The capture node instantiates the real `ChargeClicker`. The script also changes progression state and invokes attacks at predetermined intervals.

Persistence is disabled, the language is English, and capture audio is muted. The footage uses the game's rendering, but it is not a person playing an ordinary run from beginning to end.

In V2, the game node is hidden for `prime_art` and `final`. Summing every other interval produced `51.5` seconds:

| Interval category | Sum in the code |
| --- | ---: |
| Game node visible | 51.5 seconds |
| Cinematic image | 3.5 seconds |
| Final title and destination | 5.0 seconds |
| Total | 60.0 seconds |

This is a sum of scripted intervals. It is not a frame-by-frame review of the finished video measuring when the game is visible. If using the number in a production write-up, preserve how it was calculated.

## Check the final file after combining music and video

The [production README](https://github.com/takahiro-saeki/game-jam-lab/blob/f074703848586828b6a5acc0e465ccdd2c0d5244/events/2026-ai-browser-game-jam-4/submission/trailer/README.md) describes combining Godot's output with the selected music. It records choosing candidate A because its quiet/loud transitions aligned with the scene changes. This investigation did not listen to those candidates again.

The [composition script](https://github.com/takahiro-saeki/game-jam-lab/blob/f074703848586828b6a5acc0e465ccdd2c0d5244/events/2026-ai-browser-game-jam-4/tools/compose-trailer.sh) scales video to 1920×1080 and outputs a 30 fps, 60-second MP4. Audio receives `volume=0.63` and a `0.8`-second fade beginning at `59.2` seconds.

The [FFmpeg volume specification](https://ffmpeg.org/ffmpeg-filters.html#volume) defines that value as an input multiplier. `0.63` corresponds to approximately -4 dB. It does not automatically normalize to a target loudness, so it is not a measured LUFS result for the final video.

The script also refuses to overwrite an existing output path. That supports comparing V2 while retaining V1. The composition script itself was not rerun during this investigation.

## A configured 63 seconds and a file lasting 63.033333 seconds

The MP4 files were extracted from Git into temporary files and inspected with ffprobe `9.0.1`:

| Version | Resolution | Frame rate | format.duration |
| --- | --- | --- | ---: |
| V1 | 1280×720 | 30/1 | 63.033333 seconds |
| V2 | 1920×1080 | 30/1 | 60.000000 seconds |

Both contain H.264 video and stereo AAC audio at 48 kHz. V1's configured 63 seconds and its file duration are not identical. This metadata inspection alone does not locate the cause of that difference.

The README's timing table also rounds some times to whole seconds. When adjusting a caption or cut by frame, inspect the code's `4.5` seconds and the footage instead of relying on the descriptive “00:04.”

The [reproduction script](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/game-input-media-evidence.py) and [recorded results](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/production/2026-09/batch-05/game-media.json) preserve the intervals, file hashes, and ffprobe output. Neither source videos nor publication destinations were changed.

Use the interval table to decide the order of ideas and the finished file to verify the resulting order and duration. Keep the configured times alongside the durations verified in the output.
