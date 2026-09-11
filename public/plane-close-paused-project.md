---
title: "Planeで個人開発を止めるとき、CancelledとArchiveに何を残すか"
tags:
  - Plane
  - 個人開発
  - タスク管理
private: false
updated_at: null
id: null
organization_url_name: null
slide: false
ignorePublish: true
---

止めた作業を一覧から隠しても、「なぜやめたか」は残りません。Planeでは、作業を取りやめた判断と、履歴をアーカイブへ移す操作を分けて記録すると、再検討するときの根拠を保てます。

個人用PlaneでCancelledのWork Itemと、SquadNoteのアーカイブ一覧を読みました。確認できたのは取りやめ状態の作業であり、プロダクト全体を終了した記録ではありません。この記事では実際の読み取り結果から、止める際に残す情報を考えます。

## Cancelledの理由は、状態名からは復元できなかった

2026年9月11日に `stateGroup = "cancelled"` でWork Itemを検索しました。応答は1件、次ページなしで、SQN-22「個人開発でLT・登壇できる場所を探す」でした。状態はCancelledです。

本文にあったのはNotionからの移行情報と、元ページの本文がないという記述でした。現在の取りやめ理由や、再検討する条件は見つかりませんでした。移行時の元ステータスがtodoだったことから、取りやめた時期や理由を推定することもできません。

SquadNoteのアーカイブ済みWork Item一覧は0件で、次ページもありませんでした。読み取り結果では、Cancelledの作業があってもアーカイブ済みの一覧は空でした。

また、SQN-22がCancelledでも、SquadNote全体が停止したとは読めません。[固定Gitのグロース資料](https://github.com/takahiro-saeki/circle-hub/blob/a34608c611ded6549c1176a7977e68e1bc62a8db/docs/growth/README.md)には、完了した施策と後続の作業候補が分けて記録されています。個別作業の状態だけで、プロジェクト全体の扱いを決めないようにします。

## 先送り、取りやめ、非表示を分ける

[PlaneのWork Itemの説明](https://docs.plane.so/core-concepts/issues/overview)では、完了または取りやめのWork Itemをアーカイブでき、アーカイブした項目はプロジェクトのメニューから参照できます。[Projectの説明](https://docs.plane.so/core-concepts/projects/overview)には、プロジェクト全体のアーカイブと復元が別の操作として載っています。プロジェクトをアーカイブすると、通常の一覧やWorkspace検索から外れます。

この違いを使うなら、判断を次のように分けられます。

| 判断 | 状態・操作の案 | 残したい情報 |
| --- | --- | --- |
| 今は実行しないが、候補として残す | Backlogで保持 | 再検討する条件 |
| この作業を取りやめる | Cancelledにする | 理由、代わりの作業、残る影響 |
| 終了した作業を普段の一覧から外す | Work Itemをアーカイブする | 終了判断への参照 |
| プロジェクト全体を通常の導線から外す | Projectをアーカイブする | 全体の終了・休止記録と保管場所 |

この表は操作済みの記録ではなく、運用案です。一時停止中の未完了作業を隠すためだけにDoneやCancelledへ変えると、終わった理由が実態と合わなくなります。

「Icebox」を置きたい場合も、読み取ったSQNの状態一覧にはその名前はありませんでした。独自に名前を付けるとしても、候補として保留する意味を定義します。既存のPlaneの固定状態として扱いません。

## 閉じる前に、短い判断記録を残す

例えば、開発案を取りやめるなら次のような記録を作れます。SQN-22の理由を補った文章ではなく、別の架空の作業に対する例です。

```text
Decision
  Cancel the standalone prototype.

Reason
  The experiment's question will be checked in the main app instead.

Preserved evidence
  Repository revision and experiment notes.

Remaining effects
  Check whether any deployment, scheduled job, or paid resource remains.

Reconsider when
  The main app cannot reproduce the behavior being investigated.

Archive scope
  This work item only; the project remains active.
```

理由だけでなく、代わりに何をするかと、残る影響も書きます。そうすれば同じ案が後で出たときに、以前の判断が今も成り立つかを確認できます。

一方、理由が見つからない既存チケットへ、もっともらしい理由を後付けするのは避けます。SQN-22について書けるのは、現時点の本文から理由を確認できなかったことまでです。移行元に本文がない記録も、そのまま保持します。

## Projectをアーカイブする前には、外に残るものを見る

Planeでプロジェクトをアーカイブしただけでは、リポジトリや配布アプリ、定期実行のサービスが停止した証拠になりません。それらは別のシステムにあるためです。

全体を止める作業なら、対象のリポジトリ、実行環境、予約処理、利用者向けの案内が必要かを確認し、実行した結果を終了記録へ残します。これは今回実施した撤去作業ではなく、プロジェクト終了時に別途確認する範囲です。

通常の検索から外した後に探せるよう、終了記録にはプロジェクト名と保存先を残します。履歴の保存に加えて、後からその保存先へたどれるかも確かめます。

## 今回は、取りやめ理由を埋めずに残した

今回の読み取りでは、Cancelledの1件と、SquadNoteのアーカイブ済みWork Item 0件を確認しました。アーカイブや復元の操作、関連サービスの停止は試していません。調査対象の環境で、それらの操作を完走できるという検証結果もありません。

まず改善できるのは、今後取りやめる作業について、Cancelledへ変える前に理由と再検討条件を残すことです。アーカイブは、その判断を保管したうえで、普段の一覧から外す必要があるときに選べます。
