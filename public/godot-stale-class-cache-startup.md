---
title: CIは通るのにローカルでは起動しない。Godotの古いクラスキャッシュ依存をなくした
tags:
  - Godot
  - GDScript
  - CI
  - 自動テスト
  - ゲーム開発
private: false
updated_at: ''
id: null
organization_url_name: null
slide: false
ignorePublish: true
posting_campaign_uuid: null
agreed_posting_campaign_term: false
---

Godot 4でメトロイドヴァニアを開発していたとき、鐘楼エリアを追加した直後にゲームを起動できなくなりました。「ゲームを始める」を押すと`game.gd`の解析に失敗します。しかし、CIでは同じブランチのテストがすべて通っていました。

原因は、既存のローカル環境に残っていた`.godot/global_script_class_cache.cfg`です。新しく追加した`class_name`がキャッシュへ登録される前に、その名前を別のスクリプトから直接参照していました。

## 古いキャッシュでだけ解析に失敗した

鐘楼エリアでは、共通の部屋クラスを次のように定義していました。

```gdscript
extends ChurchRoom
class_name TowerRoom
```

各部屋はグローバルなクラス名を使って継承します。

```gdscript
extends TowerRoom
```

Godotが新しいクラスをインポートした後なら、このコードは問題なく解析できます。一方、鐘楼エリアを追加する前から開いていた環境には古いクラスキャッシュが残っていました。`TowerRoom`がまだグローバル型として登録されていないため、ゲーム開始時の解析で止まっていました。

テストコードにも同じ依存がありました。

```gdscript
var sentinel := await _test_spawn_enemy(
    "res://src/enemies/clockwork_sentinel.tscn",
    Vector2(320, 300)
) as ClockworkSentinel

if sentinel._state == ClockworkSentinel.State.CHARGE:
    charged = true
```

`ClockworkSentinel`も新しく追加した`class_name`です。キャッシュが更新されていない環境では、型キャストとenum参照の両方を解決できません。

## CIが不具合を見つけられなかった理由

CIはテスト前にGodotプロジェクトをインポートしていました。インポート時にグローバルクラスのキャッシュが作り直されるため、CIがテストする時点では常に正常な状態です。

ローカルでは順序が違いました。

1. 古い`.godot`が残った状態で変更を取り込む
2. エディタのキャッシュが更新される前にゲームを開始する
3. 新しいグローバル型を解決できず、スクリプトの解析に失敗する

`.godot`を削除すれば、その環境は復旧します。ただし、コードが「キャッシュ更新後でなければ解析できない」状態は変わりません。別の開発環境でも同じことが起きるため、キャッシュを消すだけではなく参照方法を直しました。

## 継承元をスクリプトパスで指定する

部屋スクリプトでは、グローバル名ではなくファイルパスを使うようにしました。

```gdscript
extends "res://src/rooms/tower_room.gd"
```

これなら`TowerRoom`がグローバルクラスとして登録される前でも、Godotは継承元のスクリプトを直接読み込めます。

## 型判定には明示的なpreloadを使う

ゲーム側では、現在の部屋が鐘楼エリアかどうかを`map is TowerRoom`で判定していました。ここもスクリプトを明示的に読み込み、継承関係をたどる実装へ変更しました。

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

敵AIのテストは、キャッシュに依存しない基底型`EnemyBase`で受け取ります。状態の比較に必要なenumは、対象スクリプトを`preload`して参照しました。

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

`GeneratedFx`や`MapMarkers`などのヘルパーも同じように明示的な`preload`へ変更しました。

## 型判定が不要なものはgroupで確認する

テストで確認したいのが「特定クラスのインスタンスか」ではなく「攻撃によってオブジェクトが生成されたか」なら、グローバル型を使う必要はありません。

たとえば蝋の床は、生成時に`wax_pool`グループへ追加します。テスト側はグループの有無を確認するだけです。

```gdscript
if child.is_in_group(&"wax_pool"):
    pool_found = true
```

鐘の衝撃波も同じ方法へ変更しました。テストの目的を保ちつつ、新しい`class_name`への依存を減らせます。

## 同じ依存をCIへ戻さない

修正後に別のコードからグローバル名を直接参照すると、同じ問題が再発します。そこで、今回対象になったクラス名を`rg`で検査する処理をテストスクリプトへ追加しました。

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

プロジェクト内の`class_name`を禁止したわけではありません。古いキャッシュで起動に失敗した、新規クラスの直接参照だけを監視しています。

## 修正後の確認

変更は19ファイルで、81行追加、33行削除でした。現在の`main`ブランチでテストを再実行し、次を確認しています。

- 古いクラスキャッシュへの依存監査がPASS
- ゲーム本体のテスト17本がすべてPASS
- 911メディアファイルの整合性を確認
- 893個のPNGをデコードできることを確認
- 110個のフレームシーケンスと参照先を確認

キャッシュ削除は目の前の環境を直す方法としては有効です。今回は、キャッシュが新しいことを起動条件にしないようコード側を変更しました。CIにも依存監査を加えたため、同じグローバル名が再び直接参照されるとテストで検出できます。

## 参考

- [Godot Engine: Scriptクラス](https://docs.godotengine.org/en/stable/classes/class_script.html)
- [DEV版: The Stale Godot Class Cache Bug That Passed CI but Broke Local Startup](https://dev.to/hirodeath/the-stale-godot-class-cache-bug-that-passed-ci-but-broke-local-startup-4jk5)
