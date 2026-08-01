---
title: "Godotで敵AI、物理挙動、マップ接続を自動テストする"
emoji: "🧪"
type: "tech"
topics: ["godot", "gamedev", "testing", "githubactions", "gdscript"]
published: false
---

Godotのゲームを手動プレイだけで確認していると、部屋や敵が増えるほど回帰を見つけにくくなります。Nocturne VaniaではheadlessテストをGitHub Actionsで動かし、敵AI、プレイヤー物理、マップ接続、アセット整合性を分けて確認しています。

見た目や面白さを自動判定するのではなく、進行不能につながる条件を先に機械で落とすためのテストです。

## headlessでシーンを起動する

ローカルではスクリプトからGodotを起動します。

```bash
GODOT_BIN=/path/to/godot bash tools/run_tests.sh
```

CIではGodotを取得し、import後に同じスクリプトを実行します。初回importで生成されるファイルがあるため、import工程とテスト実行を分けています。

## 敵AIは状態遷移を確認する

敵をシーンへ配置し、プレイヤーとの距離や時間経過を与えます。確認するのは、見た目ではなく状態と速度です。

```gdscript
enemy.global_position = Vector2(200, 100)
player.global_position = Vector2(120, 100)

await step_frames(10)
assert_true(enemy.velocity.x < 0.0)
```

敵ごとの細かい演出ではなく、索敵範囲へ入ったら追跡する、攻撃後に待機へ戻る、壁を無視して進み続けない、といった進行に影響する振る舞いを対象にします。

## 物理回帰は定数と結果の両方を見る

ジャンプ、ダッシュ、ノックバックは調整で壊れやすい箇所です。フレームを進め、移動距離や着地状態を許容範囲で確認します。

```gdscript
player.velocity = Vector2(0, GameFeel.JUMP_VELOCITY)
await step_physics(30)
assert_lt(player.global_position.y, start_y)
```

完全一致にすると物理エンジンや小さな定数変更へ過敏になるため、進行不能を検出できる範囲に絞ります。

## マップは接続の閉路を検査する

部屋を追加したとき、出口の接続先が存在するか、反対側から戻れるかを検査します。

```text
R01.east -> R03.west
R03.west -> R01.east
```

シーンファイルの存在だけでなく、部屋UIDと接続定義を走査します。片方向だけの接続や、名称変更後に残った古いpathをCIで見つけられます。

## テスト自体のハングも止める

シーン遷移やsignal待ちが終わらないと、CIが長時間止まります。テストランナーの外側にタイムアウトを置き、失敗として終了させます。

```bash
python3 tools/run_with_timeout.py 120 "$GODOT_BIN" --headless ...
```

ゲームテストで価値があったのは、操作感を数値化することより、部屋へ入れない、敵が動かない、床を抜ける、テストが終わらない、といった明確な回帰を自動化したことでした。プレイテストはその後に、面白さと手触りへ時間を使えます。
