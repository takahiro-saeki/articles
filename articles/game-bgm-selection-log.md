---
title: "ゲームBGMの採用記録を、曲数・割当先・実ファイルで照合する"
emoji: "🎵"
type: "tech"
topics: ["ゲーム開発", "godot", "音楽", "生成ai"]
published: false
---

ゲームへ音楽を追加すると、候補、採用した曲、保存したファイル、場面への割当が少しずつずれます。地図の曲を差し替えても旧曲は残せますし、別の場面が同じ音声ファイルを使うこともあります。「18曲ある」という数字だけでは、何を数えたのか分かりません。

VOLT NOMADの音楽制作資料とコードを照合したところ、BGMの割当は18スロット、参照する音声は17ファイル、撃破ジングルを加えると18ファイルでした。保管されている音声は19ファイルです。

この記事では、採用記録から再生先までを追う方法を扱います。対象は`game-jam-lab`の`f074703`、確認日は2026年9月11日です。曲の聴き比べや再生成は行っていません。

## 採用理由と、実装済みの割当を分ける

[音楽制作ブリーフ](https://github.com/takahiro-saeki/game-jam-lab/blob/f074703848586828b6a5acc0e465ccdd2c0d5244/events/2026-ai-browser-game-jam-4/docs/SUNO_MUSIC_BRIEF.md)には、用途、曲名、Sunoのsong ID、A/Bの採用案、ゲーム用ファイルが記録されています。

敵別拡張の記録では、初回の候補に短い曲が含まれ、選考から外しています。その後、長さを指定して再生成し、さらに早く終わった候補だけをやり直しています。たとえばリレイ・ヒドラの初回Aは1:54、グリッド・リーチの初回Aは2:34だった、という記録です。

これらの数字は制作時の記録であり、今回すべてのSuno候補を再取得して測った値ではありません。採用の理由として使えるのは、「その時点で尺を選考条件にしていた」と分かる範囲です。

履歴も、`5ab837b`の候補記録から`290d302`の敵別BGM追加へ進んでいます。後から曲だけが増えたのか、候補から実装へ進んだのかを区別する手掛かりになります。

## 曲名から、実際に鳴らすキーを追う

[ゲーム側の音楽コード](https://github.com/takahiro-saeki/game-jam-lab/blob/f074703848586828b6a5acc0e465ccdd2c0d5244/events/2026-ai-browser-game-jam-4/godot/games/charge_clicker/charge_clicker.gd)には、役割の違う二つの辞書があります。

`EncounterBGMKeys`は敵や形態のIDをBGMキーへ結び付けます。`BGMStreams`はそのキーを音声ファイルへ結び付けます。確認用に一部を並べると、次の関係です。

| 戦闘のID | BGMキー | 参照ファイル |
| --- | --- | --- |
| gearmaw | hunt | piston_hunt_loop.ogg |
| vaultback | vaultback | blue_vault_pulse.ogg |
| phase_mantis | phase_mantis | critical_parallax.ogg |
| prime_current_form_1 | prime_current_form_1 | prime_current_crownless_protocol.mp3 |

この二段階を追うと、名前が違うだけで未使用だと判断する誤りを避けられます。ギアモウの曲は専用名のキーではなく`hunt`です。

実際の選択は`desired_bgm_key()`が行います。タイトルや図鑑が開いているか、通常戦かボス戦か、どの最終形態かによってキーが変わります。辞書に登録しただけで、目的の場面から必ず到達できるとは限りません。今回の確認ではその選択分岐も読みましたが、全場面を実プレイで通したわけではありません。

## 18スロット、17曲、ジングル込み18ファイル

辞書とGit内の音声を機械的に数えた結果です。

| 数える対象 | 件数 |
| --- | ---: |
| `BGMStreams`のキー | 18 |
| そのキーが参照する異なる音声ファイル | 17 |
| 独立した撃破ジングルを含む参照ファイル | 18 |
| 対象音声ディレクトリの保管ファイル | 19 |

`singularity`と`ending_world`は、どちらも`arch_singularity.ogg`を使っています。場面のスロットが分かれていても、音声が二曲に増えるわけではありません。

また、旧地図曲の`subterranean_hunt.ogg`は保管されていますが、今回のBGM辞書の参照先には含まれていません。現行の地図キーは`six_core_descent.mp3`です。これは差し替え前の曲を残した結果で、見つかった未参照ファイルを削除したわけではありません。

「全18曲」という制作資料の表記は、BGMの異なるファイルと撃破ジングルを合わせた数に対応します。移植や整理のときは、キーの数、ファイルの数、保管素材の数をそれぞれ残すと、重複と取りこぼしを見分けやすくなります。

## ファイルの尺と、資料の丸めた尺を比較する

Gitから取り出した19音声ファイルをffprobeで確認しました。音声ストリームはすべて48 kHz、2チャンネルでした。次は実ファイルのdurationです。

| ファイル | ffprobeのduration（秒） |
| --- | ---: |
| blue_vault_pulse.ogg | 180.040000 |
| cascade_trinity.ogg | 179.880000 |
| critical_parallax.ogg | 179.800000 |
| nomad_victory_signal.mp3 | 12.973500 |

制作表の「3:00」や「0:13」は説明用の丸めた表記です。そのままループ点や停止時刻の厳密な入力値にはできません。今回の値も、ffprobeが報告したファイルの長さであり、音の聴こえ始めから終わりまでを耳で測った時間ではありません。

ブリーフには初期曲を約-18 LUFSへ揃えた記録もあります。ただし、元WAVはこのリポジトリに含まれていません。今回の検証でそのマスタリング作業を再現したり、全曲が現在も同じラウドネスだと確かめたりしたわけではありません。後から追加されたMP3を同じ処理済みだとも扱いません。

## ループ設定と、継ぎ目の評価は別に残す

実装ではBGMの切替時に、OggとMP3のループを有効にしています。

```gdscript
if next_stream is AudioStreamOggVorbis:
	(next_stream as AudioStreamOggVorbis).loop = true
elif next_stream is AudioStreamMP3:
	(next_stream as AudioStreamMP3).loop = true
```

[GodotのAudioStreamMP3](https://docs.godotengine.org/en/stable/classes/class_audiostreammp3.html)にも`loop`プロパティがあります。コードがループを要求していることは確認できますが、終端と冒頭が音楽的につながるかは別です。継ぎ目のノイズ、無音、拍のずれは今回聴いて確認していません。

場面間は二つのAudioStreamPlayerで切り替え、クロスフェードの設定値は`0.85`秒です。短い撃破ジングルは別のプレイヤーへ置かれ、BGMと同じ全曲ループには入っていません。これらもコード上の再生設計であり、ミックスの聴きやすさを実測した結果ではありません。

## 次の差し替えに必要な記録

この調査で使った[検証スクリプト](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/game-input-media-evidence.py)は、固定コミットの辞書と音声を読み、参照先の存在、件数、SHA-256、ffprobeの情報を保存します。[確認結果](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/production/2026-09/batch-05/game-media.json)のffprobe版は`9.0.1`です。音声の変換やアップロードは行っていません。

次に曲を差し替えるなら、候補ID、採用理由、ゲーム内キー、利用ファイルに加え、どこまで聴いて確認したかを同じ記録へ追記できます。再生先と未確認の作業も、この記録から追えます。
