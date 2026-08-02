---
title: "Pipeline for Importing AI-Generated Pixel Characters into Godot"
tags: godot, gamedev, pixelart, ai
published: false
---

This article is an English translation of the original Japanese article.

Even when you generate pixel characters through an API, dropping them directly into Godot does not turn them into usable game assets. You need to map direction, animation, frame count, save location, and adoption status.

For Nocturne Vania, I built a pipeline connecting Pixel Studio (a Next.js app for generation and review), Godot's `assets` folder, and GDScript frame definitions.

## Start with Order Sheets

For each character, I save name, description, size, orientation, and required animations as an order sheet. Instead of entering prompts in the generation UI every time, I define the necessary specifications on the game side first.

```ts
type CharacterIdea = {
  id: string;
  nameJa: string;
  description: string;
  size: number;
  status: "idea" | "generating" | "done";
  followupAnims: boolean;
};
```

During batch generation, I push order sheet IDs into a queue. After character generation completes, the system can automatically order the necessary animations.

## Link External Jobs to Local History

I save `characterId` and `jobId` from the API response.

```ts
type HistoryEntry = {
  id: string;
  kind: "character" | "animation";
  characterId: string;
  jobId: string;
  name: string;
  createdAt: string;
};
```

This allows tracking jobs even after closing the browser. On reload, the app can query the external API for status. If you download only the generated asset, you lose track of which prompt and job created it. Storing history first solves that.

## Separate Review State

Generated assets have a lifecycle like `review`, `adopted`, or `rejected`.

```ts
type AssetStatus =
  | "review"
  | "adopted"
  | "implemented"
  | "rejected";
```

When adopting an asset, I also record the target `assetPath`. This separates the fact that an image exists from the decision to use it in the game.

```json
{
  "sourceKey": "history:character-123",
  "assetPath": "assets/enemies/candle_wisp",
  "status": "implemented"
}
```

## Connect to Godot Frame Definitions

In Godot, saved spritesheets and directional images are referenced from `SpriteFrames` or GDScript frame definitions. I made sure not to use generation API animation names directly as in-game state names.

Even if the external API calls it `walking`, the game might use `run`. By placing a conversion layer, game code only sees its own state names.

```gdscript
match state:
    &"idle": play_idle()
    &"run": play_run()
    &"attack": play_attack()
```

## Audit Implemented Assets with a Manifest

`generated-assets.json` records each asset's origin and destination. Pixel Studio compares the manifest with the files in the repository and warns about missing paths or assets that are not tracked.

I do not treat generation, adoption, placement, and implementation as one status. Faster generation does not remove the work required to turn a candidate into a usable in-game asset. A separate identifier and status for each stage makes it clear where an asset is waiting.

When I publish the original article, I plan to add a side-by-side image showing the order sheet, generated candidates, and the final Godot implementation for the same character.
