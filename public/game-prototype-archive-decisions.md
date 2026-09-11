---
title: "ゲームの旧試作をarchiveへ移す。コードの保存と現在の起動対象を別々に確認する"
tags:
  - Godot
  - Git
  - 個人開発
private: false
updated_at: null
id: null
organization_url_name: null
slide: false
ignorePublish: true
---

採用しなかったゲーム試作を残す場合、ソースがGitにあることと、現在のゲームから遊べることを分けて確認します。VOLT NOMADのリポジトリでは、旧試作のコードと画像がarchiveへ移され、起動画面はVOLT NOMADへ直接進む構成になっていました。

移動commitの前後を比較すると、14ファイルは内容を変えずに残っています。一方で、古いREADMEの試作一覧はその後も残っていました。現行の機能一覧を判断するには、archive以外の確認も必要です。

## 何を残したかをGitの差分から数える

対象は`game-jam-lab`の`events/2026-ai-browser-game-jam-4/`です。2026年8月9日の[移動commit 5198488](https://github.com/takahiro-saeki/game-jam-lab/commit/51984887e2b2be66c1330a3ade8d82a9392532b6)と、その後の固定版`f074703`を2026年9月11日に調べました。

リポジトリのルートで、次の差分を読みます。

```sh
git diff-tree -r --name-status -M 5198488^ 5198488
```

`archive/retired-prototypes/`への移動として、次の14ファイルが`R100`で表示されました。

| 種類 | ファイル数 |
| --- | ---: |
| 旧試作のGDScript | 3 |
| GDScriptのUIDファイル | 3 |
| キーアート画像 | 4 |
| 画像のimportファイル | 4 |

3本のコードは`capacitor_defense`、`chargeback`、`zero_percent_city`です。[Gitの差分仕様](https://git-scm.com/docs/git-diff)にあるrename検出を使った結果に加え、移動前、移動直後、`f074703`の各ファイルをbyteで比較して一致を確認しました。

## Godotのプロジェクト境界の外へ置いている

固定版の配置は次の関係です。

```text
events/2026-ai-browser-game-jam-4/
  archive/retired-prototypes/games/
    capacitor_defense/
    chargeback/
    zero_percent_city/
  godot/
    project.godot
    main.gd
    games/charge_clicker/
```

[Godotのファイルシステム仕様](https://docs.godotengine.org/en/stable/tutorials/scripting/filesystem.html)では、`project.godot`のある場所がプロジェクトのルートで、`res://`もそこを指します。この配置のarchiveは、現行Godotプロジェクトの外側です。

起点となる[main.gd](https://github.com/takahiro-saeki/game-jam-lab/blob/f074703848586828b6a5acc0e465ccdd2c0d5244/events/2026-ai-browser-game-jam-4/godot/main.gd)は`ChargeClicker`を読み込み、`launch_project_charge`を遅延呼び出しします。旧3試作の名前はこの起点にはありません。イベントのREADMEも、旧ランチャーを含めずVOLT NOMADへ直接進むと説明しています。

今回確かめたのは配置、起点のコード、文書の対応です。書き出したPCKを比較した実験ではなく、配布サイズが何MB減ったという数値は出していません。

## ファイルを残したことは、単体で再起動できる保証ではない

archiveにはソース、画像、付随ファイルが残りますが、その場所をGodotで開くだけで旧試作が起動するとは確認していません。旧コードの`res://`参照や共通部品、シーン、入力設定は、元の配置を前提にしている可能性があります。

再び試すなら、まず保存したcommitと依存先を読み、現行の起動設定とは別に検証用のプロジェクトを用意する工程が必要です。今回、旧試作の移植や再ビルドは行っていません。

今回byte一致で確認できたのは、後で比較するためのコードが残っていることです。再実行できる環境の保存は、起動試験が必要な別の条件です。

## 現行READMEとルートREADMEが食い違っていた

`f074703`の[イベントREADME](https://github.com/takahiro-saeki/game-jam-lab/blob/f074703848586828b6a5acc0e465ccdd2c0d5244/events/2026-ai-browser-game-jam-4/README.md)はVOLT NOMADを現行ゲームとして説明しています。しかしリポジトリのルートREADMEには、旧3試作とPROJECT CHARGEを並べる表や、複数の試作を含むという説明が残っています。

これは今回の読み直しで確認できた文書のずれです。ルートREADMEだけから「現在も4本選んで遊べる」と記事へ書くと、起動コードと一致しません。移動先の名前や古い紹介文より、現在の起点と、そのcommitで更新されたイベント資料を照合します。

将来の整理では、ルートREADMEから現行ゲームへ案内し、旧試作は保存資料として説明する形が考えられます。この記事のために元リポジトリのREADMEを修正したわけではありません。

## 保存から読み取れる判断と、読み取れない理由

移動commitのメッセージは、試作ランチャーを引退させる内容です。差分からは、旧試作を失わずに現行の起点を一本へ絞ったことが読み取れます。その結果、現在のコードを読むときと、以前の案を比較するときの入口が分かれます。

ただし、3案を採用しなかった個別の評価理由や、将来再利用する予定まではこの差分に書かれていません。面白くなかった、実装が難しかった、といった理由を補うことはしません。

[14ファイルの比較と起点の確認コード](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/game-records-batch12.py)を保存しています。古い案を残す判断を説明するには、保存の実体、現在の起動対象、再実行の条件をそれぞれ確認すると、archiveを現役の機能とも完全な復元環境とも取り違えずに済みます。
