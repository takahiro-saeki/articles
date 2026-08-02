---
title: "Automated Testing for Enemy AI, Physics, and Map Connections in Godot"
tags: godot, gamedev, testing, gdscript
published: false
---

This article is an English translation of the original Japanese article.

When you rely only on manual playtesting to verify a Godot game, regressions become harder to spot as rooms and enemies multiply. For Nocturne Vania, I run headless tests in GitHub Actions to separately check enemy AI, player physics, map connections, and asset integrity.

These tests do not try to judge visual quality or fun. They catch conditions that lead to soft locks or progression blockers automatically.

## Launch Scenes Headless

Locally, a script starts Godot.

```bash
python3 tools/run_with_timeout.py 120 "$GODOT_BIN" --headless ...
```

The most useful automated checks are not attempts to measure game feel. They catch concrete regressions such as an inaccessible room, an enemy that no longer moves, a player falling through the floor, or a test process that never exits. Manual playtesting can then focus on feel and whether the game is fun to play.
GODOT_BIN=/path/to/godot bash tools/run_tests.sh
```

In CI, the workflow downloads Godot, runs import, then executes the same script. I separate import from test execution because the first import generates files.

## Enemy AI Tests Verify State Transitions

I place an enemy in a scene and feed it player distance or time progression. The tests check state and velocity, not appearance.

```gdscript
enemy.global_position = Vector2(200, 100)
player.global_position = Vector2(120, 100)

await step_frames(10)
assert_true(enemy.velocity.x < 0.0)
```

Instead of targeting fine details of each enemy's presentation, I focus on behaviors that affect progression: chasing when the player enters detection range, returning to idle after attacking, not walking through walls endlessly.

## Physics Regressions Check Both Constants and Results

Jump, dash, and knockback are areas easily broken by tuning. I step frames forward and check travel distance or landing state within tolerance.

```gdscript
player.velocity = Vector2(0, GameFeel.JUMP_VELOCITY)
await step_physics(30)
assert_lt(player.global_position.y, start_y)
```

Exact equality becomes too fragile to physics engine details or small constant changes, so I narrow the scope to what blocks progression.

## Map Tests Inspect Connection Closure

When adding a room, tests verify that exit destinations exist and that the player can return from the other side.

```text
R01.east -> R03.west
R03.west -> R01.east
```

Tests traverse room UIDs and connection definitions, not just scene file existence. CI catches one-way connections and stale paths left after renaming.

## Stop Test Hangs Too

When scene transitions or signal waits never finish, CI runs for a long time. I place a timeout outside the test runner to terminate as failure.

```bash
