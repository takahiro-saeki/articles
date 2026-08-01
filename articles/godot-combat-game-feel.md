---
title: "ヒットストップ、剣閃、コンボ専用モーションで攻撃の手触りを改善する"
emoji: "⚔️"
type: "tech"
topics: ["godot", "gamedev", "gdscript", "animation", "gamefeel"]
published: false
---

攻撃判定が正しくても、敵を斬った感触が弱い状態がありました。Nocturne Vaniaでは、ヒットストップ、画面シェイク、ノックバック、剣閃、コンボごとの前進量とモーションをまとめて調整しています。

一つの派手なエフェクトを足すのではなく、命中した瞬間に複数の短い反応を同じタイミングで出す方針です。

## 数値を一か所へ集める

戦闘の調整値は`GameFeel`へ置いています。

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

通常攻撃と3段目の差を、アニメーションだけでなく停止時間、シェイク、踏み込み量にも付けました。

## ヒットストップは実時間で解除する

命中時に`Engine.time_scale`を0へします。通常のTimerも止まるため、解除用Timerはtime scaleを無視します。

```gdscript
func request(duration: float = GameFeel.HIT_STOP) -> void:
    if Engine.time_scale < base_scale:
        return
    Engine.time_scale = 0.0
    await get_tree().create_timer(duration, true, false, true).timeout
    Engine.time_scale = base_scale
```

連続ヒットで停止要求を重ねないよう、すでに遅くなっている場合は戻ります。デバッグ用スローモーションの倍率へ復帰できるよう、固定の`1.0`ではなく`base_scale`を使います。

## コンボごとに移動と姿勢を変える

1段目、2段目、3段目で同じ斬撃画像を繰り返すと、ダメージが増えても見た目は平坦です。2段目を上段斬り、3段目を回転斬りにし、前進速度も変えました。

3段目は`COMBO_STEP_SPEED_3`で踏み込み、短時間だけ通常の地上減速を切ります。敵へ届く範囲とモーションの勢いが一致するようにしています。

## 剣閃は当たり判定と別にする

剣閃は攻撃判定そのものではなく、向きとコンボ段数に応じて出す視覚効果です。当たり判定をエフェクトの形へ合わせると、見た目を変更するたびにゲームバランスも変わります。

命中時には次を同じイベントから呼びます。

```text
damage
knockback
hit stop
camera shake
slash effect
sound
```

調整時は一つずつ切り替えて比較します。ヒットストップだけ、剣閃だけ、踏み込みだけを見た後に組み合わせると、どの要素が過剰か判断しやすくなります。

公開時には通常攻撃と調整後の3段コンボをGIFで並べる予定です。数値だけでは伝わりにくいテーマなので、同じ敵と位置で比較します。
