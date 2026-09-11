---
title: "マウス・タッチ・ゲームパッドの入力を、画面と一押しの単位で揃える"
emoji: "🎮"
type: "tech"
topics: ["godot", "ゲーム開発", "入力", "テスト"]
published: false
---

スティックを右へ倒すと、選択を一つ動かしたい。押し続けている間に届くイベントを全部「次へ」にすると、選択が飛び続けます。一方、攻撃の長押しでは、押した瞬間と離した瞬間の両方が必要です。

複数の入力へ対応するときは、デバイス名を並べるだけでなく、その画面で一回の操作をどう数えるかを決めます。VOLT NOMADの実装を固定コミットから読み、ゲームパッドの方向入力とボタン再割当をGodotで確認しました。

対象は`game-jam-lab`の`f074703`です。ここでいう検証は2026年9月11日のローカル確認であり、全対応端末でのプレイテストではありません。

## 入力の追加順を、履歴から作り直さない

履歴には、共通のゲームパッド設定を追加した`ef5cb81`が2026年8月1日、Project Chargeの原型を追加した`b3be93e`が8月2日として残っています。その後、戦闘、ギアツリー、会話、図鑑などの画面が増えています。

この記録から、完成版について「マウスを仕上げてからタッチ、その次にゲームパッド」と一本の順序を説明することはできません。共通の入力設定を受け継ぎ、増えた画面にも入力処理を追加した実装です。

[完成時点の入力コード](https://github.com/takahiro-saeki/game-jam-lab/blob/f074703848586828b6a5acc0e465ccdd2c0d5244/events/2026-ai-browser-game-jam-4/godot/games/charge_clicker/charge_clicker.gd)では、まず開いている画面を判定し、その画面の処理へ渡して`return`しています。会話を閉じる操作が、同じ関数の後半にある戦闘操作まで進まないようにする構造です。

## 画面を選んでから、入力を解釈する

`_unhandled_input()`の入口では`set_input_as_handled()`を呼び、その後に会話、設定、タイトル、ギアツリーなどを振り分けます。

ここには二つの役割があります。Viewportで処理済みにすることと、関数内の別の画面処理へ流さないことです。前者を呼んでも、実行中の関数が自動で戻るわけではありません。各分岐の`return`も必要です。[GodotのInputEvent説明](https://docs.godotengine.org/en/stable/tutorials/inputs/inputevent.html)は、イベント配送と処理済み指定の関係を確認する出発点になります。

通常の戦闘へ届いた入力は、次のように処理されています。

| 入力 | 実装の受け取り方 |
| --- | --- |
| 左クリック | 押下時に座標を判定し、離したときにチャージを終了 |
| タッチ | 押下座標を同じ操作へ渡し、離したときにチャージを終了 |
| キーボード | echoを除いたイベントを専用ハンドラへ渡す |
| ゲームパッドのボタン | 専用ハンドラへ渡す |
| 左スティック | 方向を一回分へ変換してから選択を動かす |

これはソースから確認した経路です。ブラウザがタッチから生成するマウスイベントや、複数の指を同時に置いたときの挙動までは今回実行していません。マウスとタッチの分岐が両方あることだけで、すべての端末で二重入力がないとは判断しません。

## スティックを戻すまで、次の一回を出さない

方向選択に使う関数は次の内容です。ゲーム本体から変更せず抜き出し、`controller_axis_latch`だけを持つ小さなクラスに入れて実行しました。

```gdscript
func controller_motion_direction(event: InputEventJoypadMotion) -> Vector2i:
	var direction := Vector2i.ZERO
	if event.axis == JOY_AXIS_LEFT_X:
		if absf(event.axis_value) < 0.45:
			controller_axis_latch.x = 0
		elif controller_axis_latch.x == 0:
			controller_axis_latch.x = 1 if event.axis_value > 0.0 else -1
			direction.x = controller_axis_latch.x
	elif event.axis == JOY_AXIS_LEFT_Y:
		if absf(event.axis_value) < 0.45:
			controller_axis_latch.y = 0
		elif controller_axis_latch.y == 0:
			controller_axis_latch.y = 1 if event.axis_value > 0.0 else -1
			direction.y = controller_axis_latch.y
	return direction
```

軸の絶対値が`0.45`未満へ戻ると、ラッチを解除します。それ以外では、未入力の状態から初めて倒されたときだけ方向を返します。

合成した横軸のイベントを順番に渡すと、次の結果になりました。

| 軸の値 | 返った方向 | 状態の意味 |
| ---: | --- | --- |
| 0.2 | なし | 中立側 |
| 0.7 | 右 | 最初の一回 |
| 0.8 | なし | 倒したまま |
| -0.8 | なし | 中立を通るイベントがまだない |
| 0.1 | なし | ラッチ解除 |
| -0.8 | 左 | 次の一回 |

正から負へ値だけを飛ばしたケースでも、中立のイベントがなければ反対方向は出ません。この関数は長押しで一定時間ごとに進むリピート機能を持っていないためです。実機の感触に合わせてこの仕様を変えるなら、別の再入力条件を設計する必要があります。

全体では10イベントを検証し、横軸がラッチされた状態でも縦軸は独立して一回を出すことも確認しました。

## 再割当で、ほかの入力まで消さない

[共通のコントローラー設定](https://github.com/takahiro-saeki/game-jam-lab/blob/f074703848586828b6a5acc0e465ccdd2c0d5244/events/2026-ai-browser-game-jam-4/godot/shared/controller_bindings.gd)は、既に別の操作が使っているボタンへ変更すると、元のボタンと入れ替えます。二つの操作が同じボタンへ重なるのを避ける実装です。

また、InputMapの更新では`InputEventJoypadButton`だけを取り除きます。同じアクションに割り当てたキーボードまで消す処理ではありません。

今回、実際のクラスに対して次を確認しました。

- primaryを既存のsecondaryのボタンへ移すと、secondaryは元のprimaryのボタンになる。
- 許可していないボタンや存在しない操作IDは拒否され、設定は変わらない。
- attackのゲームパッドボタンを変更しても、事前に設定したSpaceキーは残る。

これらは共通クラスの検証です。VOLT NOMADの各画面に、すべてのキー割当が自動で反映されることを証明したわけではありません。実際のゲーム側では独自のボタン判定も使われているため、画面別の経路を確認する必要があります。

## 確認できた範囲を、そのまま対応表へ戻す

実行環境はGodot `4.6.2.stable.official.71f334935`のheadlessモードです。元のゲームの保存データは読み込まず、設定保存も無効にして実行しました。[再現スクリプト](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/game-input-media-evidence.py)と[入力の実行結果](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/production/2026-09/batch-05/game-input.json)を残しています。

今回確かめたのは、合成イベントを受け取った後の変換と再割当です。実ブラウザでのフォーカス、タッチからのイベント生成、コントローラーの接続・切断、ボタン表記、長時間の操作感は別の確認項目です。

入力対応の確認表には「ゲームパッド対応」だけでなく、対象画面、押下・解放・継続の意味、今回通した入力列を書きます。対応表には、コードで確認した結果と、人が端末で確認した結果を別々に残します。
