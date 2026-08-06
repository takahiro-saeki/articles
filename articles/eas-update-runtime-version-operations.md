---
title: "EAS Update導入後のproduction、preview、runtimeVersion運用"
emoji: "📦"
type: "tech"
topics: ["expo", "eas", "reactnative", "mobile", "cicd"]
published: true
---

ExpoアプリへEAS Updateを導入し、JavaScriptと画像だけの修正をストア審査なしで配信できるようにしました。ただし、コマンドが動くだけでは安全に運用できません。どのビルドへ更新が届くかを決める`channel`と`runtimeVersion`が必要です。

現在はdevelopment、preview、productionの3チャンネルと、`appVersion`ポリシーを組み合わせています。

## channelをビルドプロファイルへ固定する

`eas.json`では、ビルドごとに接続先APIとchannelを設定します。

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "channel": "development",
      "env": {
        "APP_ENV": "development",
        "EXPO_PUBLIC_API_URL": "https://dev.squad-note.com"
      }
    },
    "preview": {
      "distribution": "internal",
      "channel": "preview",
      "env": {
        "APP_ENV": "production",
        "EXPO_PUBLIC_API_URL": "https://squad-note.com"
      }
    },
    "production": {
      "autoIncrement": true,
      "channel": "production"
    }
  }
}
```

previewは本番APIを使う内部配布版です。productionへ出す前に、同じデータ条件でOTA更新を確認できます。developmentはdev APIへ接続するため、previewとは用途を分けています。

## runtimeVersionはappVersionに合わせた

Expo configは次の設定です。

```ts
updates: {
  url: "https://u.expo.dev/<project-id>",
  fallbackToCacheTimeout: 0,
},
runtimeVersion: {
  policy: "appVersion",
},
```

アプリの`version`が`1.0.11`なら、そのruntime向けに公開したUpdateだけが届きます。ネイティブ構成の異なる古いバイナリへ、新しいJavaScriptを誤配信しにくい設定です。

`fallbackToCacheTimeout: 0`なので、起動時に更新取得を待ち続けません。取得したUpdateは次回起動で反映する運用です。

## OTAで出す変更とストアへ出す変更

productionへUpdateを出してよいのは、JavaScriptとアセットだけで完結する変更です。

```bash
cd apps/mobile
eas update --channel preview --message "日付表示を修正"
eas update --channel production --message "日付表示を修正"
```

次の変更では新しいバイナリを作ります。

- ネイティブライブラリの追加や更新
- `app.config.ts`のplugins、ios、android設定変更
- Expo SDKの更新
- `runtimeVersion`へ影響するアプリversionの変更

依存パッケージの変更をすべてOTA不可と決めるのではなく、そのパッケージがネイティブコードを含むかを確認します。判断しにくい場合は通常ビルドへ回しています。

## 実際の公開順

日常的な修正では、次の順序にしました。

1. ローカルとExpo Goまたはdevelopment buildで確認
2. preview channelへ配信
3. 内部配布版を再起動して確認
4. production channelへ同じ変更を配信
5. 次回のネイティブ変更ではversionを上げてストア提出

EAS Updateはリリースを速くしますが、ストアビルドを不要にはしません。channelは配信先、runtimeVersionは互換性の境界です。この二つを別の役割として決めてから、更新コマンドを運用へ入れました。

## 参考

- [Expo: EAS Update](https://docs.expo.dev/eas-update/introduction/)
- [Expo: Runtime versions](https://docs.expo.dev/eas-update/runtime-versions/)
