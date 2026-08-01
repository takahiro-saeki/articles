---
title: LINE内ブラウザを考慮してWeb URLとアプリDeep Linkを使い分けた
tags:
  - LINE
  - DeepLink
  - ReactNative
  - Nextjs
  - Expo
private: false
updated_at: ''
id: null
organization_url_name: null
slide: false
ignorePublish: true
posting_campaign_uuid: null
agreed_posting_campaign_term: false
---

日程や招待リンクをLINEで共有すると、リンクはLINE内ブラウザで開きます。公開ページの閲覧だけなら問題ありませんが、Googleログインが必要なページでは認証が通らないケースがありました。

対策として、共有する入口はHTTPS URLに統一し、Web側で外部ブラウザへの案内が必要か判断する構成にしました。

## custom schemeを直接共有しない

アプリには`custom scheme`があります。

```text
squadnote://invite/org_123
```

ただし、このURLはアプリ未インストール時に行き先がありません。LINEへ共有するURLには、Webでも開けるHTTPSを使います。

```text
https://squad-note.com/invite/org_123?openExternalBrowser=1
```

iOSではUniversal Linksを設定しているため、アプリが入っていれば同じHTTPS URLからアプリを開けます。入っていない端末はWebページを表示します。

## 公開ページと会員ページを分ける

日程共有では、公開設定によってpathを変えています。

```ts
const path = schedule.isPublic
  ? `/s/${orgId}/${scheduleId}`
  : `/organizations/${orgId}/schedules/${scheduleId}`;

const url = `${config.apiUrl}${path}?openExternalBrowser=1`;
```

公開日程ならログイン不要の`/s/...`を共有します。非公開日程はメンバー向けのpathです。すべてを認証画面へ送ると、リンクを受け取った人が内容を確認できるか分からなくなるためです。

## パラメータはアプリを開くためではない

`openExternalBrowser=1`はUniversal Linksを有効にする設定ではありません。LINE内ブラウザでWebが開かれた場合に、外部ブラウザへ移る案内を出すための合図です。

役割を分けると次のようになります。

- HTTPS URL: 共有時の共通入口
- Universal Links: インストール済みアプリとの関連付け
- Webの公開ページ: アプリ未導入ユーザーの受け皿
- `openExternalBrowser=1`: LINE内ブラウザでの認証回避

クエリを付けるだけでLINEがSafariやChromeを自動的に開くわけではありません。Web側でUser-Agentやクエリを確認し、外部ブラウザで開く手順を表示します。

## 共有文はURLと分離する

React Native側ではOSの共有シートを使いました。

```ts
const name = schedule.title ?? schedule.location ?? "練習";
const message = `${name} ${date} ${startTime}-${endTime}\n${url}`;

await Share.share({ message });
```

共有文から遷移先を復元せず、URL自体に必要なIDを持たせます。アプリ側もWeb側も同じpathを解釈できるため、共有先ごとの分岐をReact Nativeへ増やさずに済みました。

LINE対策とDeep Linkは似て見えますが、別の層の問題です。共有URLはHTTPSに寄せ、アプリとの関連付けとWeb側のブラウザ対策を独立させると整理しやすくなります。

## 参考

- [Expo: Linking into your app](https://docs.expo.dev/linking/overview/)
- [Apple: Supporting associated domains](https://developer.apple.com/documentation/xcode/supporting-associated-domains)
