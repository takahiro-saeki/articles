---
title: "Improving Combat Feel with Hit Stop, Slash Effects, and Combo Animations"
tags: godot, gamedev, gdscript, animation
published: false
---

This article is an English translation of the original Japanese article.

Even when attack collision is correct, hitting an enemy can feel weak. For Nocturne Vania, I tuned hit stop, screen shake, knockback, slash effects, and per-combo step distance and motion together.

Instead of adding one flashy effect, the approach fires multiple short reactions at the same moment of impact.

## Gather Numbers in One Place

Combat tuning values live in `GameFeel`.

```gdscript
const HIT_STOP: float = 0.05
const FINISHER_HIT_STOP: float = 0.09
const HIT_SHAKE: float = 1.5
const FINISHER_SHAKE: float = 3.0
const COMBO_STEP_SPEED_2: float = 120.0
const COMBO_STEP_SPEED_3: float = 220.0
const COMBO_LUNGE_TIME: float = 0.13
const ENEMY_KNOCKBACK_SPEED: float = 160.0
```

The third hit differs from normal attacks in its animation, stop duration, shake, and lunge distance.

## Release Hit Stop in Real Time

On hit, I set `Engine.time_scale` to 0. Normal Timers also stop, so the release Timer ignores time scale.

```gdscript
func request(duration: float = GameFeel.HIT_STOP) -> void:
    if Engine.time_scale < base_scale:
        return
    Engine.time_scale = 0.0
    await get_tree().create_timer(duration, true, false, true).timeout
    Engine.time_scale = base_scale
```

To avoid stacking stop requests from continuous hits, I return if the game is already slowed. To restore debug slow-motion multiplier, I use `base_scale` instead of fixed `1.0`.

## Change Movement and Posture per Combo

Repeating the same slash sprite for first, second, and third hits keeps visuals flat even when damage increases. I made the second hit an overhead slash, the third a spin slash, and changed step speed for each.

The third hit lunges at `COMBO_STEP_SPEED_3` and briefly disables normal ground deceleration. This makes the range where the attack reaches enemies match the motion's momentum.

## Separate Slash Effect from Hit Box

Slash effects are visual responses triggered by facing direction and combo number, not the attack collision itself. If you match hit box to effect shape, every visual change also changes game balance.

On hit, I call these from the same event:

```text
damage
knockback
hit stop
camera shake
slash effect
sound
```

When tuning, I toggle one at a time for comparison. After looking at hit stop alone, slash alone, lunge alone, then combining them, it becomes easier to judge which element is excessive.
