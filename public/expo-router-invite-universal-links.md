---
title: Expo RouterでWebの招待リンクをそのままアプリの招待画面として開く
tags:
  - Expo
  - ExpoRouter
  - ReactNative
  - UniversalLinks
  - iOS
private: false
updated_at: '2026-08-05T09:08:20+09:00'
id: a229ae95d7686b70ec90
organization_url_name: null
slide: false
ignorePublish: false
posting_campaign_uuid: null
agreed_posting_campaign_term: false
---

サークル管理アプリで、次のような招待URLをWebとiOSアプリの両方で使っています。

```text
https://squad-note.com/invite/{orgId}
```

アプリが入っていればExpo Routerの招待画面を開き、入っていなければWebページを表示します。共有するURLをWeb用とアプリ用に分けず、1本にできるのがUniversal Linksを採用した理由です。

## Expo Routerのファイル構成

招待画面は動的ルートとして置いています。

```text
apps/mobile/src/app/invite/[orgId]/index.tsx
```

画面ではURLの`orgId`を`useLocalSearchParams`から取得します。

```tsx
import { useLocalSearchParams, useRouter } from "expo-router";

export default function InviteScreen() {
  const { orgId } = useLocalSearchParams<{ orgId: string }>();
  const router = useRouter();

  const { data: org, isLoading } = api.organization.getPublic.useQuery(
    { id: orgId! },
    { enabled: !!orgId },
  );

  // 招待内容を表示して、参加処理を実行する
}
```

`/invite/abc`で開かれた場合、`orgId`には`abc`が入ります。Web側にも同じpathのページを用意しています。

## custom schemeを設定する

アプリ固有のURLも扱えるよう、Expo configにはschemeを設定しています。

```ts
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  scheme: "squadnote",
});
```

これで、開発や認証コールバックでは次のようなURLを扱えます。

```text
squadnote://invite/abc
```

ただし、ユーザーへ共有する招待URLにはHTTPSを使っています。custom schemeは同じschemeを別アプリが宣言できるため、通常のWeb URLを安全にアプリへ関連付けられるUniversal Linksを入口にしました。

## iOSのAssociated Domains

`app.config.ts`では、本番とdevでドメインを分けています。

```ts
ios: {
  bundleIdentifier: IS_PROD
    ? "com.squadnote.app"
    : "com.squadnote.app.dev",
  associatedDomains: IS_PROD
    ? ["applinks:squad-note.com"]
    : ["applinks:dev.squad-note.com"],
}
```

設定を追加しただけでは動きません。Web側のドメインから`apple-app-site-association`も返します。

```text
https://squad-note.com/.well-known/apple-app-site-association
```

Next.js側ではRoute Handlerとして配置しました。

```text
apps/web/src/app/.well-known/apple-app-site-association/route.ts
```

レスポンスにはApple Developer Team IDとBundle IDを組み合わせた`appID`、アプリで開くpathを定義します。招待リンクだけを対象にするなら、`/invite/*`へ範囲を絞れます。

## 共有するURL

モバイル側でも共有するのはHTTPS URLです。

```ts
const inviteUrl = `${config.apiUrl}/invite/${id}?openExternalBrowser=1`;

await Share.share({
  message: `${orgName}への招待です\n${inviteUrl}`,
});
```

アプリが入っているiOS端末ではUniversal Linkとしてアプリを開きます。それ以外ではWebの招待ページが開きます。

`openExternalBrowser=1`はLINE内ブラウザ向けにWeb側で使っているパラメータです。Universal Linksの設定とは別の問題なので、アプリの関連付けとWeb側のブラウザ対策を分けて考えています。

## 確認するときの注意

Universal Linksは、アプリをインストールした状態、ドメインのAASA、署名されたビルドの組み合わせで動きます。Expo Goだけでは本番と同じ確認になりません。

私は次を分けて確認しています。

- TestFlight版が入った端末でメッセージ内のURLをタップする
- アプリを削除した状態で同じURLを開く
- 本番ドメインとdevドメインを取り違えていないか確認する
- AASA URLがリダイレクトなしでJSONを返すことを確認する
- すでに所属しているユーザーと未参加ユーザーを確認する

Expo Routerではpathとファイル構成が対応するため、アプリ内の招待画面を作る部分は単純でした。時間がかかったのは、アプリではなくドメインとiOSの関連付けです。

## 参考

- [Expo Router: Link to your app](https://docs.expo.dev/linking/overview/)
- [Expo Router: Typed routes](https://docs.expo.dev/router/reference/typed-routes/)

