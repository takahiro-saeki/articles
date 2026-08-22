---
devto_id: 4457358
canonical_url: https://zenn.dev/hirodeath/articles/metroidvania-save-data-design
title: "How I Designed Save Data for a Metroidvania"
tags: godot, gamedev, gdscript, metroidvania
published: true
---

This article is an English translation of the original Japanese article.

Metroidvania save data needs more than current position. It includes explored map regions, acquired abilities, defeated bosses, and collected items. When you move map layout later, old save coordinates shift too.

For Nocturne Vania, I wrapped MetSys's SaveManager and added game-specific restore information plus a migration version.

## Collect Save Logic in an Autoload

The save path is `user://save.sav`. Each save point sends data to the `SaveGame` autoload instead of touching the file directly.

```gdscript
const SAVE_PATH := "user://save.sav"
const MAP_LAYOUT_VERSION: int = 1

func save_state(game: Node, room_uid: String, spawn_pos: Vector2, extra := {}) -> void:
    var manager := SaveManager.new()
    manager.store_game(game)
    manager.set_value("map_layout_version", MAP_LAYOUT_VERSION)
    manager.set_value("room", room_uid)
    manager.set_value("spawn_x", spawn_pos.x)
    manager.set_value("spawn_y", spawn_pos.y)
    for key in extra:
        manager.set_value(key, extra[key])
    manager.save_as_text(SAVE_PATH)
```

On top of the exploration state MetSys manages, I add restore room, coordinates, and game-specific flags.

## Return Abilities and Pickups in Reproducible Form

Load results go into a Dictionary.

```gdscript
return {
    room = manager.get_value("room", ""),
    pos = Vector2(
        manager.get_value("spawn_x", 100.0),
        manager.get_value("spawn_y", 300.0)),
    shadow_dash = manager.get_value("shadow_dash", false),
    wall_jump = manager.get_value("wall_jump", false),
    bonus_max_hp = int(manager.get_value("bonus_max_hp", 0)),
    hp_ups = Array(hp_ups_raw.split(",", false)),
    boss_wizard_defeated = manager.get_value("boss_wizard_defeated", false),
}
```

Unsaved keys have fallback defaults. Even when adding a new ability, old saves load.

## Attach Version to Map Changes

During development, I moved the entire MapData down 8 cells. Room UIDs and in-room coordinates stay the same, but discovered cells and custom markers depend on coordinates.

```gdscript
const MAP_V1_OFFSET := Vector3i(0, 8, 0)

if int(raw_data.get("map_layout_version", 0)) < MAP_LAYOUT_VERSION:
    _migrate_map_layout_v1(raw_data)
```

Migration adds offset to `discovered_cells` and `custom_markers` coordinates, and updates coordinate strings inside `cell_overrides`.

Room-identifying UIDs and collected objects do not move. Instead of rewriting all data uniformly, I target only the items that depend on layout coordinates.

## Store the Intent to Continue

Only the title screen's Continue action and the game-over restart path set `pending_load` to true before opening the game scene. This distinguishes a new game from a scene launch that should restore saved state automatically.

Save format design already matters during development. Map layouts change frequently while the game is still taking shape, so versions and fallback values are useful before release. Separating stable identifiers such as room UIDs from mutable values such as map coordinates keeps each migration small.
