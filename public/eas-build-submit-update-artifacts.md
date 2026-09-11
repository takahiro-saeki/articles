---
title: "EAS Build・Submit・Updateの違いを、成功後にできるものから確認する"
tags:
  - Expo
  - EAS
  - ReactNative
  - リリース
private: false
updated_at: null
id: null
organization_url_name: null
slide: false
ignorePublish: true
---

EASの処理が成功しても、どの段階が終わったかはコマンドによって違います。Buildはアプリのバイナリを作り、Submitはそのバイナリをストア側へ送り、Updateは対応するインストール済みアプリへ配るJavaScriptやアセットを公開します。

「配布できた」と記録する前に、何を作り、どこへ渡したかを確認します。iOSのSubmit完了を一般公開と読み替えないことや、Androidでは提出先トラックの扱いを確認することも、この区別に含まれます。

## 同じプロジェクトでも、コマンドの対象は違う

2026年9月11日に公式資料を確認し、circle-hubの固定commit `a34608c`にある[モバイルのscripts](https://github.com/takahiro-saeki/circle-hub/blob/a34608c611ded6549c1176a7977e68e1bc62a8db/apps/mobile/package.json)と照合しました。

依存定義はExpo ~54.0.33、expo-updates ~29.0.12です。この調査ではEAS CLIのビルド・提出・更新コマンドを実行していません。現在の公式説明と、固定コードが呼ぼうとしているコマンドを確認したものです。

| 処理 | 主に受け取るもの | 成功後に確認するもの |
| --- | --- | --- |
| Build | ソース、依存、ネイティブ設定、ビルド設定 | 作成したアプリバイナリ |
| Submit | ストア提出用の署名済みバイナリ、提出設定 | ストア側へのアップロード結果と、その後の状態 |
| Update | 対応するアプリ向けのJavaScriptとアセット | 公開した更新と、対象アプリでの受信・適用 |

BuildとSubmitは連携できますが、成功したBuildがすべて自動的に提出されるわけではありません。auto-submitを指定するか、別の提出処理を用意するかで動作が変わります。

## Buildは、どこへ入れられるバイナリかを見る

[ExpoのBuildの説明](https://docs.expo.dev/build/introduction/)では、アプリバイナリを作成するサービスとして定義されています。開発用、内部配布用、ストア向けでは、生成物の使い道が異なります。

固定コードにある次の定義は、productionという名前のプロファイルでiOSのBuildを要求します。

```json
{
  "build:prod": "eas build --profile production --platform ios"
}
```

この文字列にSubmitやauto-submitの指定はありません。したがって、このscriptsを読んだだけで「ストア提出も行う」とは判断しません。別の手順があるかは追加で確認する必要があります。

[eas.json](https://github.com/takahiro-saeki/circle-hub/blob/a34608c611ded6549c1176a7977e68e1bc62a8db/apps/mobile/eas.json)ではdevelopmentとpreviewにinternalの指定があり、別々のchannelを持っています。プロファイル名だけで配布先を決めず、中の設定と生成された成果物を見ます。

ビルドの成功で確認できるのは、そのビルド処理が成果物を作った段階です。実際にインストールできたか、起動したか、必要な操作が通ったかは、その成果物を使った次の確認です。

## Submitの後は、iOSとAndroidを同じ扱いにしない

[Expoのストア提出の説明](https://docs.expo.dev/deploy/submit-to-app-stores/)では、Submitは署名済みバイナリをApp Store ConnectやGoogle Play Consoleへ送ります。EAS Buildで作成したものに限らず、要件を満たすバイナリも提出できます。

iOSでは、アップロード後の処理を経てTestFlightで扱う段階と、App Storeへの審査・一般公開が分かれています。Submit成功だけで一般公開済みとは記録しません。

Androidでは、どのトラックへ提出するか、releaseStatusをどう指定するかで、その後の扱いが変わります。「Submitは常にアップロードするだけで、公開状態には影響しない」と一括りにもしません。今回対象にするアプリの提出設定を読みます。

この記事ではストアの実状態を取得していません。過去のBuildやSubmitの成否、審査結果、現在の配布トラックを推測していないため、この表はリリース実績ではありません。

## Updateで、ネイティブ設定まで変わるとは考えない

[ExpoのUpdateの説明](https://docs.expo.dev/eas-update/introduction/)が対象とするのは、JavaScriptやスタイル、画像などの非ネイティブ部分です。受け取るアプリにはexpo-updatesの組み込みと適切な設定が必要です。

固定コードにはproductionとpreviewへ向けた更新scriptsがあります。[アプリ設定](https://github.com/takahiro-saeki/circle-hub/blob/a34608c611ded6549c1176a7977e68e1bc62a8db/apps/mobile/app.config.ts)はruntimeVersionにappVersionを使い、SecureStoreやSplashScreenなどのconfig pluginも指定しています。

例えばJavaScriptの文言修正と、SplashScreenのネイティブ設定変更を同じ更新手順へ流すべきかは、ファイル名だけでは決まりません。[SplashScreenの設定仕様](https://docs.expo.dev/versions/latest/sdk/splash-screen/)にあるように、バイナリへ組み込む設定を変える場合は、新しいバイナリが必要です。対応する更新だけを受け取る条件も、別途確認します。

Updateの公開が成功しても、すべての対象端末がその版を取得・適用したという意味にはなりません。更新を作成した結果と、アプリ側の適用結果を別々に記録します。

## 次の工程へ渡す前に、結果の名前を具体化する

リリース記録なら、「EAS成功」の代わりに次のような欄へ分けられます。実際の結果を埋めた表ではなく、記録形式の案です。

| 工程 | 記録する結果の例 | まだ別に確認すること |
| --- | --- | --- |
| Build | 対象プロファイル、生成物への参照 | インストールと動作 |
| Submit | 対象ストア、送った生成物、提出結果 | 処理・審査・トラックや公開の状態 |
| Update | 対象channel、公開した更新への参照 | 対象アプリでの取得と適用 |

固定scriptsと公式仕様を照合すると、Build、Submit、Updateを一つの成功フラグへまとめると情報が足りないことが分かります。どこまで実施したかを残せば、次の担当者は必要な成果物から確認を再開できます。

今回行ったのはGitの読み取りと設定関数の評価です。ビルド費用、アップロード時間、反映時間、端末への到達率は測っていません。実際の配布結果を記録するには、対象の工程と成果物を使った確認が残っています。
