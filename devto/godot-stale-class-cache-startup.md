---
devto_id: 4356688
title: The Stale Godot Class Cache Bug That Passed CI but Broke Local Startup
tags: devchallenge, bugsmash, godot, gamedev
published: true
---

*This is a submission for [DEV's Summer Bug Smash: Clear the Lineup](https://dev.to/bugsmash) powered by [Sentry](https://sentry.io/).*

## Project overview

Nocturne Vania is a small pixel-art Metroidvania built with Godot 4. The game has interconnected rooms, enemy AI, save data, unlockable movement abilities, and a growing automated test suite.

I hit this bug after adding a bell tower area. The new rooms, enemies, effects, and map markers used GDScript's `class_name` keyword so they could be referenced as global types.

The new area worked in a freshly imported project and in CI. It did not always work in an existing local checkout.

## Bug fix or performance improvement

Godot stores imported project data under `.godot`. An editor session that predated the bell tower scripts could still have an old `global_script_class_cache.cfg`. In that state, starting the game caused a parse error because scripts such as `game.gd` referred directly to global types that were missing from the stale cache.

One room script, for example, inherited from a new global class by name:

```gdscript
extends TowerRoom
```

The test code also used the new classes for casts and enum access:

```gdscript
var sentinel := await _test_spawn_enemy(
    "res://src/enemies/clockwork_sentinel.tscn",
    Vector2(320, 300)
) as ClockworkSentinel

if sentinel._state == ClockworkSentinel.State.CHARGE:
    charged = true
```

Those references were valid after Godot refreshed its global class registry. Before that refresh, the parser could not resolve them.

CI missed the problem because the test workflow imported the project before running the suite. The import regenerated the cache, so CI always tested the healthy state. Local startup followed a different order and exposed the bug.

Refreshing or deleting `.godot` could repair one checkout, but it left the startup dependency in the code. I wanted the game to parse even before the editor rebuilt the cache.

## Code

I merged the complete fix as PR #95 in the project's private repository. Since the repository is not publicly accessible, the relevant before-and-after code is included below.

The first change was to use a script path when a room inherited from one of the newly added classes:

```gdscript
extends "res://src/rooms/tower_room.gd"
```

For runtime checks, I loaded the script resource explicitly instead of asking the parser to resolve `TowerRoom` as a global name:

```gdscript
const TOWER_ROOM_SCRIPT := preload("res://src/rooms/tower_room.gd")

func _is_tower_room(node: Node) -> bool:
    if node == null:
        return false

    var script: Script = node.get_script() as Script
    while script != null:
        if script == TOWER_ROOM_SCRIPT:
            return true
        script = script.get_base_script()

    return false
```

The enemy tests now use their stable base type. They read the state through the object and compare it with an enum from an explicitly loaded script:

```gdscript
const CLOCKWORK_SENTINEL_SCRIPT := preload(
    "res://src/enemies/clockwork_sentinel.gd"
)

var sentinel: EnemyBase = await _test_spawn_enemy(
    "res://src/enemies/clockwork_sentinel.tscn",
    Vector2(320, 300)
)

if int(sentinel.get("_state")) == CLOCKWORK_SENTINEL_SCRIPT.State.CHARGE:
    charged = true
```

Temporary objects such as wax pools and bell shockwaves did not need a global type check at all. I added them to groups and tested the behavior that mattered:

```gdscript
if child.is_in_group(&"wax_pool"):
    pool_found = true
```

Effects and map marker helpers received the same explicit `preload` treatment. The fix covered 19 files with 81 additions and 33 deletions.

## My improvements

I added a static check to stop cache-sensitive global names from returning outside their own `class_name` declarations:

```bash
CACHE_SENSITIVE='\b(TowerRoom|BelfrySpider|BellRingerWretch|CandleBearerSkeleton|CarrionCrow|ClockworkSentinel|GeneratedFx|MapMarkers|TowerImp|WaxSlime)\b'

CACHE_REFS=$(rg -n "$CACHE_SENSITIVE" src --glob '*.gd' \
  | grep -vE 'class_name (TowerRoom|BelfrySpider|BellRingerWretch|CandleBearerSkeleton|CarrionCrow|ClockworkSentinel|GeneratedFx|MapMarkers|TowerImp|WaxSlime)' \
  || true)

if [ -n "$CACHE_REFS" ]; then
    echo "FAIL(stale-cache): direct reference to a newly added global class"
    exit 1
fi
```

This check is intentionally narrow. `class_name` is still useful in the project, and I did not want to ban it. The guard covers the recently added classes that caused this startup regression.

I ran the full test command again on the current `main` branch while preparing this submission:

```text
PASS(stale-cache)
PASS(rooms)
PASS(transition)
PASS(save)
PASS(progression)
PASS(gameover)
PASS(pause)
PASS(dash)
PASS(boss)
PASS(enemies)
PASS(walljump)
PASS(combo)
PASS(skins)
PASS(area3)
PASS(area3-enemies)
PASS(enemy-ai)
PASS(physics)
PASS(connections)
== ALL PASS ==
```

The asset check also passed for 911 media files, including 893 decoded PNGs and 110 frame sequences.

Clearing a bad cache would have repaired one checkout. The durable fix removes the undocumented requirement that the cache must be fresh before the project can be parsed. CI now checks the dependency directly, and the game no longer relies on editor state to reach its startup path.
