---
title: "Expo Push Token・FCM Token・APNs Tokenは、送信先のAPIから区別する"
tags:
  - Expo
  - Push通知
  - Firebase
  - APNs
private: false
updated_at: null
id: null
organization_url_name: null
slide: false
ignorePublish: true
---

Push Tokenを保存するときは、文字列だけでなく、それを受け付ける送信サービスを把握します。Expo Push TokenをAPNsへ渡したり、APNs TokenをExpo Push APIの宛先へ置いたりしても、同じ端末を指す別名としては扱えません。

Expoを使うアプリでも、Expo Push Serviceを経由する経路と、FCMやAPNsへ直接送る経路があります。取得側と送信側を読み、両方が同じ経路を使っているかを確認します。

## 取得APIと送信APIを対応させる

2026年9月11日に[Expo Notificationsの公式資料](https://docs.expo.dev/versions/latest/sdk/notifications/)を確認しました。最新版ページの推奨版は~57.0.17です。次の表はネイティブのiOS・Androidでの取得方法を整理したものです。

| 値 | 取得する側の例 | 受け付ける送信サービス |
| --- | --- | --- |
| Expo Push Token | getExpoPushTokenAsync | Expo Push Service |
| Androidのネイティブトークン | getDevicePushTokenAsync | FCM |
| iOSのネイティブトークン | getDevicePushTokenAsync | APNs |

Expo Push TokenはExpo側の宛先、FCM TokenはFirebase側の宛先、APNs TokenはApple側の宛先です。OS名だけから送信先を決めるのではなく、どのAPIから取得した値かを確認します。

[Expo Push Serviceの送信説明](https://docs.expo.dev/push-notifications/sending-notifications/)に沿うと、Expoを経由する構成は次のようになります。

```text
App -> getExpoPushTokenAsync -> Expo Push Token -> Application server

Application server -> Expo Push Service -> FCM -> Android
Application server -> Expo Push Service -> APNs -> iOS
```

アプリのサーバーがExpoへ送る時点で使うのはExpo Push Tokenです。FCMとAPNsへ渡す処理は、この経路ではExpo側が担当します。

## iOSでFCMを使う場合は、別の登録経路がある

FCMはAndroid専用という意味ではありません。[FirebaseのApple向け設定](https://firebase.google.com/docs/cloud-messaging/ios/get-started)では、APNs TokenとFCMの登録トークンを関連付ける処理を説明しています。

その構成ならサーバーはFCMの宛先を使い、FCMがAPNsへの配送を扱います。ただし、expo-notificationsでiOSのgetDevicePushTokenAsyncを呼んだ結果を、そのままFCM登録トークンと呼ぶことはできません。Firebase側の登録と対応付けが別に必要です。

同じ「iOSの通知」という目的でも、APNsへ直接送るのか、Firebaseを経由するのか、Expoを経由するのかで、保存する宛先の意味が変わります。

## 実リポジトリはExpoを経由していた

題材のcircle-hubは、固定commit `a34608c`を読みました。依存定義はExpo ~54.0.33、expo-notifications ~0.32.17で、最新ドキュメントの推奨版と同じ環境ではありません。

[取得側のコード](https://github.com/takahiro-saeki/circle-hub/blob/a34608c611ded6549c1176a7977e68e1bc62a8db/apps/mobile/src/lib/push-notifications.ts)はgetExpoPushTokenAsyncのdataをサーバーへ登録します。[送信側のコード](https://github.com/takahiro-saeki/circle-hub/blob/a34608c611ded6549c1176a7977e68e1bc62a8db/apps/web/src/server/api/lib/expo-push.ts)はExpo Push APIへPOSTする実装です。この組み合わせは、表のExpoの経路に対応しています。

ここで片側だけをgetDevicePushTokenAsyncへ変更すると、サーバーが受け付ける宛先の前提が変わります。取得APIを置き換える修正なら、DBの意味、送信サービス、必要な資格情報まで一緒に見直します。この記事ではその移行をしていません。

トークンの更新や複数端末の管理は、経路が決まった後の別の設計です。今回はまず、登録される値と送信先の対応を確認しています。

## 文字列の見た目に頼らず、宛先を型で分ける

複数の経路を扱う場合の提案として、providerを持つ型を作れます。以下は元のアプリに追加済みのコードではありません。

```ts
type PushDestination =
  | { provider: "expo"; token: string }
  | { provider: "fcm"; token: string }
  | { provider: "apns"; token: string };

function makeExpoPayload(
  destination: Extract<PushDestination, { provider: "expo" }>,
) {
  return { to: destination.token, title: "Routing example" };
}
```

TypeScript 7.0.2、strictで、providerがexpoの値を渡すコードは通りました。apnsとfcmをそれぞれ渡す比較では、どちらもTS2322になりました。これは送信せずに、型の取り違えを確認した結果です。

関数名をmakeExpoPayloadにしているのも、単なる「Push用のJSON」より受け付ける宛先が分かるためです。別サービスの資格情報やリクエスト形式を、この関数へ混ぜません。

この型は文字列の真正性を証明しません。外部から受け取るJSONには実行時検査が必要で、providerがexpoでもトークンが有効とは限りません。トークンの接頭辞だけを見て、信頼できる登録元やプロジェクトの確認まで省くことはできません。

## トークン、送信受付、端末表示を同じ結果にしない

Expoの送信受付で返るチケットと、FCMやAPNsへの配送結果を調べるreceiptは段階が異なります。トークンを取得できたことだけでは、送信も表示も確認できません。

今回の検証は公式仕様、固定コードの取得・送信経路、型の3ケースです。実トークンの取得、資格情報の設定、通知送信、端末表示は行っていません。実際の到達確認は、ここで特定した経路で別途行う必要があります。
