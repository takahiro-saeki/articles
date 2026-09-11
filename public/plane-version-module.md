---
title: "PlaneのModuleをバージョン単位にする前に、配布物の識別情報を分けておく"
tags:
  - Plane
  - Expo
  - 個人開発
private: false
updated_at: null
id: null
organization_url_name: null
slide: false
ignorePublish: true
---

「1.0.11の確認」と書いてあっても、どのアプリを確認したかは一意に決まりません。iOSとAndroidがあり、同じ表示バージョンでもビルドし直すことがあるからです。

PlaneのModuleをリリース単位に使うなら、Module名には予定する成果物を、確認結果には実際に調べた配布物の識別情報を残します。Module名だけでは、検証した配布物を特定できません。

## Moduleはまだ運用していない

2026年9月11日にSquadNoteのModule一覧を読みました。通常の一覧とアーカイブ一覧は、ともに0件で次ページもありませんでした。ここで示すModule構成は導入案です。Planeへの作成、ビルド、ストア提出は行っていません。

[PlaneのModuleの説明](https://docs.plane.so/core-concepts/modules)では、機能や節目でWork Itemをまとめられ、一つのWork Itemを複数のModuleへ関連付けられます。たとえば機能のModuleとリリースのModuleに、同じ作業を含められます。

ただし、関連付けがあることから、そのバージョンの配布物で確認済みとは判断できません。所属は予定の範囲を表し、確認結果は実際に検証した対象を表すためです。

## Gitには複数の「版」が書かれている

題材はcircle-hubの固定commit `a34608c`です。[アプリ設定](https://github.com/takahiro-saeki/circle-hub/blob/a34608c611ded6549c1176a7977e68e1bc62a8db/apps/mobile/app.config.ts)と[EAS設定](https://github.com/takahiro-saeki/circle-hub/blob/a34608c611ded6549c1176a7977e68e1bc62a8db/apps/mobile/eas.json)を読みました。リポジトリの履歴を固定した値で、現在の配布版を示す表ではありません。

| 項目 | Gitで確認した値 | 読み取れること |
| --- | --- | --- |
| version | 1.0.11 | 設定上の表示バージョン |
| ios.buildNumber | 2 | ファイル内のiOSビルド番号 |
| android.versionCode | 1 | ファイル内のAndroidビルド番号 |
| cli.appVersionSource | remote | EAS側でビルド番号を管理する設定 |
| production.autoIncrement | true | productionビルドで自動増分を使う設定 |
| runtimeVersion.policy | appVersion | runtimeVersionの方針 |

[Expoのバージョン管理仕様](https://docs.expo.dev/build-reference/app-versions/)では、remoteを使う場合、ビルド番号をEAS側で管理し、ローカル設定の値はその増分に合わせて更新されません。したがって、この表の2と1を、提出済みの最新ビルド番号として転記することはできません。

この記事ではEASのビルド履歴を取得していません。配布物の番号は未確認のまま残します。Gitに値があることと、確認すべき外部成果物の値が分かったことを分ける必要があります。

## Moduleと確認記録に、別の役割を持たせる

導入するなら、Module名を「SquadNote 1.0.11の配布準備」のような人が読む予定名にします。その下の確認作業では、対象を絞れる情報を残します。

```json
{
  "module_label": "SquadNote 1.0.11 release preparation",
  "verification_target": {
    "platform": "ios",
    "channel": "testflight",
    "app_version": "1.0.11",
    "build_number": null,
    "artifact_reference": null,
    "source_commit": null
  },
  "verification_result": "not_run"
}
```

これは追加する記録形式の例です。既存ModuleのAPI応答でも、提出済みビルドのデータでもありません。nullを埋めずに確認済みへ変えることは想定していません。

この例のsource_commitを調査に使った `a34608c`で機械的に埋めるのも避けます。読んだコードのcommitと、実際に配布物を作ったcommitが同じだと確認できていないからです。

| 確認する対象 | 記録に追加したい識別情報 |
| --- | --- |
| iOSのTestFlightビルド | アプリの版、ビルド番号、配布物への参照、作成元commit |
| Androidのテスト配布 | アプリの版、versionCode、配布トラックまたは配布物、作成元commit |
| Web | 環境、deploymentの識別情報、作成元commit |
| ゲームの配布ファイル | 対象OS、配布ファイル、checksum、作成元commit |

この表は媒体ごとの記録案です。Webやゲームにも同じアプリバージョン形式を強制する必要はありません。確認者が同じ対象へたどれることを揃えます。

## ビルドし直したときは、確認結果を上書きしない

仮に、あるiOSビルドを確認した後、同じ表示バージョンでビルドし直したとします。Module名が変わらなくても、前の確認結果が新しい配布物へ自動的に適用されるわけではありません。

新しい配布物の行を作り、再確認が必要な項目を決めます。共通の修正内容を説明するWork Itemは再利用できますが、「どの配布物で成功したか」の記録は分けます。前の結果を消すと、後で問題が出たときに比較対象を失います。

予定からAndroidを次回へ送る場合も、単にModuleから外すだけでなく、対象変更と残作業を残します。これは期日の運用とは別に、今回の配布対象を再現するための記録です。

## 今回確認できた範囲

確認結果は、Moduleが通常・アーカイブとも0件であること、固定Gitにある設定値、remote版管理の公式仕様です。Moduleを作った後の画面表示、ビルド番号の取得、配布テストは実施していません。

配布物が未確認のまま、リリース表を完成扱いにはできません。最初のModuleでは予定と実績の欄を分け、確認結果を記入するときに対象の識別情報が揃っているかを照合する、という導入から始められます。
