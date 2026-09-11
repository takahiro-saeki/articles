---
title: "Expo Routerの初期URLとurlイベントを、同じ到着待ちとして扱わない"
tags:
  - Expo
  - ReactNative
  - ExpoRouter
  - DeepLink
private: false
updated_at: null
id: null
organization_url_name: null
slide: false
ignorePublish: true
---

Expo Routerで起動直後の遷移を調べるときは、初期URLの取得結果と、起動後のurlイベントを別々に記録します。初期URLを待つ時間と、起動後のイベント購読は別々に確認する必要があります。

Expo Router 6.0.24の実装を、ネイティブAPIとタイマーの境界だけ差し替えて実行しました。Android向けの分岐では、初期URL取得より先にタイムアウトを発火させるとルートへフォールバックしました。その後に初期URLのPromiseを解決しても、確定済みの結果は変わりません。一方、別に発火させたurlイベントは購読側へ届きました。

## 最初に、どの入口を調べているか決める

React Nativeの[Linking仕様](https://reactnative.dev/docs/linking)では、URLによる起動をgetInitialURL、起動済みアプリへのURLをurlイベントで扱います。これはアプリ側から見た入口の区別です。OSがどの状態でどちらを呼ぶかまで、JavaScriptの単体試験からは確定しません。

Expo Routerはリンクの処理を組み込んでいます。[Expoの説明](https://docs.expo.dev/linking/into-your-app/)も、Router利用時と手動でLinkingを処理する場合を分けています。診断用にURLを観測するだけなら、追加した購読からrouter.pushを呼ぶ必要はありません。Routerの遷移と重なる処理を増やさないためです。

題材のcircle-hubの固定commit `a34608c`では、[ルートレイアウト](https://github.com/takahiro-saeki/circle-hub/blob/a34608c611ded6549c1176a7977e68e1bc62a8db/apps/mobile/src/app/_layout.tsx)と[通知処理](https://github.com/takahiro-saeki/circle-hub/blob/a34608c611ded6549c1176a7977e68e1bc62a8db/apps/mobile/src/lib/push-notifications.ts)を確認しました。通知応答からの遷移はありますが、ルートレイアウトに独自のgetInitialURL待ちはありません。今回の実験を、そのアプリで発生したURL取りこぼしの記録とは扱いません。

## 固定した版では、iOSとAndroidで取得経路が違う

検証日は2026年9月11日です。macOS 26.6.2、Node.js 24.15.0、Expo 54.0.33、React Native 0.81.5、Expo Router 6.0.24、Expo Linking 8.0.12を使いました。比較用アプリはSDKに対応するRouterを固定しています。題材リポジトリのRouter宣言は5.0.7で、今回実行した版と同じではありません。

インストール済みパッケージのlink/linking.jsとgetLinkingConfig.jsを実行し、次を確認しました。下表のURLはすべて試験用です。

| 条件 | 初期URLの結果 | 確認した範囲 |
| --- | --- | --- |
| iOSの同期getterがURLを返す | articlelab://detail?item=cold | Expo Linking側の同期取得を1回呼ぶ |
| iOSの同期getterがnullを返す | articlelab:/// | ルートへフォールバック |
| Androidの取得がタイマーより先に解決 | articlelab://detail?item=early | 初期URLを採用 |
| Androidのタイマーが先に発火 | articlelab:/// | 後から初期URLが解決しても結果は同じ |
| Androidの取得が先にreject | reject | この分岐ではルートへの成功結果に変わらない |

Android側には150ミリ秒のタイマーを使うPromise.raceがありました。試験では実時間を150ミリ秒待つ代わりに、渡された値が150であることを確認し、タイマーのコールバックを明示的に発火させています。これは競合する処理の順番を変える試験で、端末での取得時間の測定ではありません。

iOS側はExpo Linkingの同期getterを通りました。「React NativeのgetInitialURLはPromiseを返す」というAPIの説明だけから、Router内部も両OSで同じ待ち方だとは判断できません。

## 初期値の確定と、その後のイベントを分ける

タイマーを先に発火させたAndroid条件で、次の順番を作りました。

```text
1. Router starts reading the initial URL
2. The controlled timeout callback runs
3. Initial routing resolves to articlelab:///
4. The native initial-URL Promise resolves late
5. The settled initial result remains articlelab:///
6. A separate runtime URL event reaches the subscriber
```

最後のイベントは、試験側が別に発火させています。遅れて解決した初期URLが、自動的にurlイベントへ変換された結果ではありません。実機でURLがどちらへ届くかを調べるには、両方の入口の記録が必要です。

さらにgetLinkingConfigが返す初期取得を続けて呼ぶと、同じPromiseが返り、ネイティブ取得は1回でした。少なくともこの版の設定オブジェクトでは、呼び直すことを初期URLの再取得手段として期待できません。

## アプリに置く観測は、遷移を追加せずに行う

比較用アプリでは、モジュール読み込み時に次の取得を行いました。traceは、起動ごとの識別子と通し番号を付け、ローカルの記録サーバーへ送る関数です。

```js
export const initialURL = Linking.getInitialURL().then(url => {
  trace('initial-url', { url });
  return url;
});
```

加えてルートのeffectでurlイベントを購読し、usePathnameの変化も記録しています。取得したURL、受信したイベント、Routerが選んだpathnameを違うイベント名で残すことで、「値が届かない」と「値の後で遷移しない」を切り分けます。実サービスのURLには機密情報が含まれ得るため、保存する診断値は対象パスなど必要な範囲へ絞ります。今回の値は試験専用です。

iOS 26.5 Simulator用にReleaseビルドを作り、URLを渡さない2回の起動では、React NativeのgetInitialURLはどちらもnull、記録されたpathnameは/でした。これはRouter内部の同期getterを直接観測したログではありません。

Macのロックにより画面操作ができず、simctl openurlが成功終了した後にも、URLの受信や新たな起動ログは確認できませんでした。リンク経由のcold startと起動中の配送は、ネイティブ動作の成功例へ数えていません。Android実機も未実行です。

## 再現コードと、ここから判断できること

[比較用コード](https://github.com/takahiro-saeki/articles/tree/codex/article-stock-2026-09/experiments/article-stock-2026-09)のmobile-batch15でlockfileどおりに依存を入れ、リポジトリのルートから`node experiments/article-stock-2026-09/probe-mobile-js-batch15.mjs`を実行できます。実パッケージのJavaScriptを読み、ネイティブAPI、イベント発火、タイマーを制御する試験です。OSのリンク配送は再現しません。

初期取得のタイムアウト後に初期Promiseを解決する試験と、実行中のurlイベントを届ける試験を分けて用意します。イベントが届いているのに遷移が違うなら、次に認証ガードやRouter側の状態を調べます。初期URLだけを待つ時間の調整では、その違いは見えません。
