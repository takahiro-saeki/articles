---
title: "Review AI-Generated Assets In-Game Instead of Adopting Them Directly"
tags: godot, gamedev, pixelart, ai
published: false
---

This article is an English translation of the original Japanese article.

A pixel character that looks good in the generation screen can blend into the background when placed in the game. Outline, size, and animation speed appear different under actual camera zoom and next to other enemies.

For Nocturne Vania, I do not finalize candidates from an image gallery alone. I combine a mechanism to switch and playtest them in Godot with review states in Pixel Studio.

## Switch Player Skins at Runtime

Player skin definitions are separated. Debug input F8 cycles through candidates in order.

```gdscript
var current_skin_index := 0

func cycle_skin() -> void:
    current_skin_index = (current_skin_index + 1) % skins.size()
    apply_skin(skins[current_skin_index])
```

Without rebuilding scenes, I compare in the same room, same input, and against the same enemies. I check not just idle poses but also running, jumping, attacking, and taking damage.

## Have a Look-Dev Room

For assets other than characters, I line them up in `look_dev.tscn`. Background color, floor, lighting, and camera zoom are kept close to the main game. Multiple candidates appear under the same conditions.

What I verify differs per asset type:

- Characters: silhouette and animation readability
- Effects: contrast over background and display duration
- Tiles and props: seam and density when repeated

I look at whether the asset fulfills its role in-game, not whether the image is beautiful in isolation.

## Separate Review State from Game Implementation

In Pixel Studio, assets can move to `review`, `adopted`, or `rejected`. Pressing adopt does not delete the image on the external service. Only the review state is saved.

Assets actually placed in `assets` and registered in the manifest with a path are matched as `implemented`. This keeps human judgment separate from repository implementation facts.

```json
{
  "sourceKey": "history:hero-v3",
  "assetPath": "assets/player/hero_v3",
  "status": "implemented"
}
```

## Fix Comparison Conditions

Viewing candidate A and candidate B in different scenes pulls attention to differences other than the asset. The switch function changes only appearance while preserving player position, camera, enemies, and input.

Because I keep previous candidates after adoption, I can revert and compare when something feels wrong. I prioritized the ability to redo adoption decisions over generation cost.

AI-generated assets make it easy to increase candidates but easy to get stuck in the selection process. Separating in-game comparison, review state, and implementation manifest prevents losing sight of intermediate states like "generated but unconfirmed" or "adopted but not implemented."
