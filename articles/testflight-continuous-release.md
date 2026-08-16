---
title: "個人開発アプリをTestFlightへ継続的に出すためのリリース手順"
emoji: "✈️"
type: "tech"
topics: ["expo", "eas", "testflight", "ios", "個人開発"]
published: true
---

個人開発では、リリース手順を覚えているうちに次のビルドを出せるとは限りません。数週間空くと、versionとbuild numberの違い、証明書、EAS Updateとの境界をもう一度調べることになります。

SquadNoteではEAS BuildとEAS Submitを使い、ストア提出が必要な変更とOTAで出せる変更を分けています。

## versionとbuild numberを分ける

Expo configにはユーザーへ見えるversionを置きます。

```ts
export default {
  version: "1.0.11",
  ios: {
    bundleIdentifier: "com.squadnote.app",
    buildNumber: "2",
  },
};
```

EAS側では`appVersionSource`をremote、production buildを`autoIncrement: true`にしています。

```json
{
  "cli": {
    "appVersionSource": "remote"
  },
  "build": {
    "production": {
      "autoIncrement": true,
      "channel": "production"
    }
  }
}
```

同じversionでTestFlightビルドを作り直すときも、build numberは重複できません。自動採番に任せることで、提出直前の番号修正を減らしています。

## リリース前に変更の種類を判定する

JavaScriptと画像だけならEAS Updateを使えます。ネイティブライブラリ、Expo SDK、plugin、iOS設定を変えた場合は新しいビルドが必要です。

新しいバイナリを出すときはversionを決め、次を確認します。

- `expo install --check`と`expo-doctor`
- TypeScriptとテスト
- production APIのURL
- Universal Linksや権限文言などのExpo config
- 実機でログイン、通知、主要画面

## production buildとsubmit

ビルドはモバイルpackageで実行します。

```bash
cd apps/mobile
eas build --platform ios --profile production
```

完了したビルドをTestFlightへ送ります。

```bash
eas submit --platform ios --profile production --latest
```

`eas.json`のsubmit profileにはApp Store ConnectのApp IDとTeam IDを設定しています。認証情報そのものはリポジトリへ置きません。

## TestFlightで確認する範囲

development buildで動いても、production署名と本番ドメインでしか確認できない機能があります。Universal Links、Sign in with Apple、Push通知はTestFlight版で確認します。

確認後、同じversionへの軽微なJS修正はproduction channelへOTA配信できます。ネイティブ変更が入ったら次のversionへ進みます。

## 手順をコミットへ残す

リリース時はversion更新を独立したコミットにしています。どのコードがTestFlightへ提出されたかをGitの履歴から追いやすくするためです。

継続的に出すために一番効いたのは、自動化の量より判断基準を固定したことでした。OTAでよいか、バイナリが必要か、TestFlightで何を確認するかが決まっていれば、久しぶりの提出でも手順を戻れます。

## 参考

- [Expo: Build for app stores](https://docs.expo.dev/deploy/build-project/)
- [Expo: Submit to app stores](https://docs.expo.dev/submit/introduction/)
