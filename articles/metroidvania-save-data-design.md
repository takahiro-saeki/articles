---
title: "メトロイドヴァニアのセーブデータをどう設計したか"
emoji: "💾"
type: "tech"
topics: ["godot", "gamedev", "gdscript", "save", "metroidvania"]
published: false
---

メトロイドヴァニアのセーブには、現在位置だけでなく探索済みマップ、取得能力、倒したボス、回収済みアイテムが必要です。マップを後から移動すると、古いセーブの座標もずれます。

Nocturne VaniaではMetSysのSaveManagerをラップし、ゲーム固有の復帰情報とmigration versionを追加しています。

## セーブ処理をautoloadへ集める

保存先は`user://save.sav`です。各セーブポイントが直接ファイルを触らず、autoloadの`SaveGame`へ渡します。

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

MetSysが管理する探索状態に、復帰部屋と座標、ゲーム固有のフラグを足します。

## 能力と取得物は再現できる形で返す

ロード結果はDictionaryへまとめます。

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

未保存のキーには初期値を用意します。新しい能力を追加しても、古いセーブをロードできます。

## マップ変更にはversionを持たせる

開発中にMapData全体を下へ8セル移動しました。部屋UIDと部屋内座標は変わりませんが、探索済みセルとカスタムマーカーは座標依存です。

```gdscript
const MAP_V1_OFFSET := Vector3i(0, 8, 0)

if int(raw_data.get("map_layout_version", 0)) < MAP_LAYOUT_VERSION:
    _migrate_map_layout_v1(raw_data)
```

migrationでは`discovered_cells`と`custom_markers`の座標へoffsetを足し、`cell_overrides`内の座標文字列も更新します。

部屋そのものを識別するUIDや回収済みobjectは移動しません。データ全体を一律に書き換えず、レイアウト座標へ依存する項目だけを対象にしました。

## 「つづきから」の意図も状態にする

タイトル画面とゲームオーバーからゲームシーンを開く場合だけ、`pending_load`をtrueにします。通常のニューゲームと、シーン起動後に自動ロードする経路を区別するためです。

セーブ形式は完成後だけの問題ではありません。マップを頻繁に変える開発中ほど、versionと初期値が役立ちます。部屋UIDのような安定した識別子と、マップ座標のように変わる値を分けて保存すると、migrationの範囲を小さくできます。
