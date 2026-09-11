---
title: "Define one input action per screen across mouse, touch, and gamepad controls"
published: false
tags: [godot, gamedev, testing, input]
canonical_url: https://zenn.dev/hirodeath/articles/game-input-support-sequence
---

Pushing a stick right should move the selection once. Treat every event received while the stick remains tilted as “next,” and the selection keeps jumping. Charging an attack, meanwhile, needs both the press and the release.

Supporting several input devices requires defining what counts as one action on each screen. This investigation read a fixed version of VOLT NOMAD and tested its gamepad direction conversion and button remapping in Godot.

The source is `game-jam-lab` at `f074703`. Verification took place locally on September 11, 2026; it was not a playtest across every supported device.

## Do not invent an implementation sequence from the finished feature list

The history records shared gamepad settings in `ef5cb81` on August 1, 2026, and the Project Charge prototype in `b3be93e` on August 2. Combat, gear trees, dialogue, and gallery screens subsequently grew around that code.

This does not support a linear story of finishing mouse support, then touch, then gamepad support. The implementation inherited shared input settings and added handlers as screens appeared.

The [input code at the inspected revision](https://github.com/takahiro-saeki/game-jam-lab/blob/f074703848586828b6a5acc0e465ccdd2c0d5244/events/2026-ai-browser-game-jam-4/godot/games/charge_clicker/charge_clicker.gd) first selects the open screen, dispatches to its handler, and returns. An action closing dialogue should not continue into the combat handling later in the same function.

## Select the screen before interpreting the input

At its entry, `_unhandled_input()` calls `set_input_as_handled()`. It then routes events to dialogue, settings, the title, the gear tree, and other screens.

Marking an event handled in the Viewport and stopping execution inside the current function are separate jobs. The former does not automatically return from that function; the branch's `return` matters too. [Godot's InputEvent documentation](https://docs.godotengine.org/en/stable/tutorials/inputs/inputevent.html) explains event delivery and the handled flag.

Events reaching ordinary combat follow these paths:

| Input | Handling in the implementation |
| --- | --- |
| Left mouse button | Check position on press; end charging on release |
| Touch | Pass the press position to the same operations; end charging on release |
| Keyboard | Send events without echo to a dedicated handler |
| Gamepad button | Send events to a dedicated handler |
| Left stick | Convert motion into a single direction action before moving selection |

These paths were inspected in source. This run did not test browser-generated mouse events from touch or multiple simultaneous fingers. Having both mouse and touch branches does not establish an absence of duplicate input on every device.

## Wait for neutral before emitting another direction

This is the direction-selection function. It was extracted unchanged from the game and executed in a small class containing only the required `controller_axis_latch` state.

```gdscript
func controller_motion_direction(event: InputEventJoypadMotion) -> Vector2i:
	var direction := Vector2i.ZERO
	if event.axis == JOY_AXIS_LEFT_X:
		if absf(event.axis_value) < 0.45:
			controller_axis_latch.x = 0
		elif controller_axis_latch.x == 0:
			controller_axis_latch.x = 1 if event.axis_value > 0.0 else -1
			direction.x = controller_axis_latch.x
	elif event.axis == JOY_AXIS_LEFT_Y:
		if absf(event.axis_value) < 0.45:
			controller_axis_latch.y = 0
		elif controller_axis_latch.y == 0:
			controller_axis_latch.y = 1 if event.axis_value > 0.0 else -1
			direction.y = controller_axis_latch.y
	return direction
```

Returning below an absolute axis value of `0.45` clears the latch. Otherwise, the function emits a direction only when the stick first leaves the unlatched state.

Synthetic horizontal-axis events produced this sequence:

| Axis value | Returned direction | Meaning |
| ---: | --- | --- |
| 0.2 | None | Within the neutral region |
| 0.7 | Right | First action |
| 0.8 | None | Still tilted |
| -0.8 | None | No neutral event has arrived |
| 0.1 | None | Latch cleared |
| -0.8 | Left | Next action |

Even jumping directly from a positive to a negative value does not emit the opposite direction without a neutral event. This function has no timed repeat while held. Changing that behavior to suit physical controls requires a different rule for repeated input.

The full check covered 10 events, including the vertical axis independently emitting an action while the horizontal axis remained latched.

## Remapping must preserve other input types

The [shared controller settings class](https://github.com/takahiro-saeki/game-jam-lab/blob/f074703848586828b6a5acc0e465ccdd2c0d5244/events/2026-ai-browser-game-jam-4/godot/shared/controller_bindings.gd) swaps assignments when a new button is already assigned to another action. That avoids binding two actions to the same button.

When updating InputMap, it removes only `InputEventJoypadButton` events. It does not clear keyboard events assigned to the same action.

Tests against the actual class verified that:

- Moving primary to secondary's existing button moves secondary to primary's previous button.
- Unsupported buttons and unknown action IDs are rejected without changing the bindings.
- Changing attack's gamepad button preserves a previously assigned Space key.

These checks cover the shared class. They do not prove that every key assignment automatically reaches every VOLT NOMAD screen. The game also performs its own button checks, so each screen's route needs inspection.

## Record the scope of support precisely

The runtime was Godot `4.6.2.stable.official.71f334935` in headless mode. The test did not read the game's saved progress, and writing controller settings was disabled. The [reproduction script](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/game-input-media-evidence.py) and [input results](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/production/2026-09/batch-05/game-input.json) are recorded.

This run verified conversion and remapping after synthetic events arrived. Browser focus, event generation from touch, controller connection and disconnection, button labels, and comfort during extended play require separate checks.

An input support checklist should record the screen, the meaning of press, release, and continued input, and the sequence actually tested. Record code-level checks separately from actions a person has verified on a device.
