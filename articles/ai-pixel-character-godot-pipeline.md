---
title: "AI生成したピクセルキャラクターをGodotへ取り込むパイプライン"
emoji: "🎨"
type: "tech"
topics: ["godot", "gamedev", "pixelart", "ai", "nextjs"]
published: true
---

ピクセルキャラクターを生成APIで作っても、そのままGodotへ置くだけではゲーム素材になりません。方向、アニメーション、フレーム数、保存先、採用状態を対応付ける必要があります。

Nocturne Vaniaでは、生成とレビューを行うNext.js製のPixel Studioと、Godotの`assets`、GDScriptのフレーム定義をつなぐパイプラインを作りました。

## 発注書から始める

キャラクターごとに名前、説明、サイズ、向き、必要なアニメーションを発注書として保存します。生成画面で毎回promptを入力するのではなく、ゲーム側で必要な仕様を先に決めます。

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

一括生成時は発注書IDをキューへ入れ、キャラクター生成が完了した後に必要なアニメーションを続けて発注できます。

## 外部ジョブとローカル履歴を結び付ける

APIの返却値から`characterId`と`jobId`を保存します。

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

ブラウザを閉じてもジョブを追跡でき、再読込時に外部APIへ状態を問い合わせられます。生成物だけをダウンロードすると、どのpromptとジョブから作られたかが分からなくなるため、履歴を先に残します。

## レビュー状態を別に持つ

生成済み素材には、`review`、`adopted`、`rejected`などのライフサイクルがあります。

```ts
type AssetStatus =
  | "review"
  | "adopted"
  | "implemented"
  | "rejected";
```

採用時には保存先の`assetPath`も記録します。画像が存在することと、ゲームで使うことを分けるためです。

```json
{
  "sourceKey": "history:character-123",
  "assetPath": "assets/enemies/candle_wisp",
  "status": "implemented"
}
```

## Godot側のフレーム定義へつなぐ

Godotでは、保存したspritesheetや方向別画像を`SpriteFrames`またはGDScriptのフレーム定義から参照します。ここで生成APIのアニメーション名を、そのままゲームの状態名にしないようにしました。

外部では`walking`でも、ゲーム側では`run`を使うことがあります。変換層を置き、ゲームコードは自分たちの状態名だけを見ます。

```gdscript
match state:
    &"idle": play_idle()
    &"run": play_run()
    &"attack": play_attack()
```

## manifestで実装済み素材を監査する

`generated-assets.json`には出自と保存先を記録します。Pixel Studioはmanifestと実ファイルを照合し、存在しないpathや未追跡素材を警告します。

生成、採用、配置、実装を一つの完了状態にまとめないことが、このパイプラインで一番効きました。AI生成の速度が上がっても、ゲーム内で使える状態へ変換する工程は残ります。各段階に識別子と状態を持たせると、どこで止まっているかを追えます。

記事公開時には、発注書、生成候補、Godot上の実装結果を同じキャラクターで並べた画像を追加する予定です。
