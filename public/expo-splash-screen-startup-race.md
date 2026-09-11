---
title: "SplashScreenを閉じる条件を、フォント読み込みから画面の準備完了へ広げる"
tags:
  - Expo
  - ReactNative
  - SplashScreen
  - テスト
private: false
updated_at: null
id: null
organization_url_name: null
slide: false
ignorePublish: true
---

フォント読み込みが終わっても、認証確認を待っている画面はまだ表示できません。閉じる条件には、アプリが最初に表示する内容の準備を含めます。

iOS Simulator用のReleaseアプリで、同じフォント読み込みと認証待ちの代替処理を使い、hideを呼ぶ場所だけ比較しました。フォント完了後に閉じる条件ではauthReadyがfalse、内容のレイアウト後に閉じる条件ではtrueでした。確認したのは呼び出し順序で、白い画面の表示時間を測定した結果ではありません。

## 比較用アプリで待っているもの

検証日は2026年9月11日です。macOS 26.6.2、iOS 26.5 Simulator、Expo 54.0.33、React Native 0.81.5、Expo Router 6.0.24、expo-font 14.0.12、expo-splash-screen 31.0.13を固定し、Release構成でビルドしました。Expo Goでの見た目を製品版の結果として扱わないためです。

現在の[SplashScreen公式資料](https://docs.expo.dev/versions/latest/sdk/splash-screen/)は、SDK 52以降のExpo Goや開発ビルドでは製品版のスプラッシュ体験を完全には再現しないことと、Releaseでの確認を説明しています。最新資料のパッケージ推奨は~57.0.8で、ここで実行した31.0.13とは分けて読んでいます。

比較ではuseFontsに同梱フォントを渡し、認証確認に相当する非同期処理をlocalhostのHTTP応答で代替しました。代替サーバーは4000ミリ秒待ってreadyを返します。これは順番の差を観測しやすくするための固定遅延で、実認証の速度ではありません。資格情報や実アカウントも使っていません。

## 自動終了を止める呼び出しは、描画より前に置く

比較用のルートモジュールでは、コンポーネントの外で次を実行しました。traceは、起動識別子と通し番号を付ける記録用関数です。

```js
trace('prevent-request');
void SplashScreen.preventAutoHideAsync().then(value => trace('prevent-result', { value }));
```

公式資料はpreventAutoHideAsyncをグローバルスコープで、awaitせずに呼ぶことを勧めています。コンポーネントやeffectまで待つと、自動で閉じた後になる可能性があるためです。今回の2回の起動ではpreventAutoHideAsyncの結果はtrueでした。

ここで止めるのはスプラッシュの自動終了です。フォント取得、認証確認、画面のレイアウトが、このAPIによって自動的に一つの待機処理になるわけではありません。

## フォントだけを見る条件と、内容のレイアウトを見る条件

比較用アプリはfontsLoadedまたはfontErrorが確定し、authReadyがtrueになり、比較モードを読み終えるまでnullを返します。したがって、フォントだけ完了しても、その時点では画面内容を返していない場合があります。

earlyモードでは、フォントの結果が確定したeffectからhideAsyncを呼びました。coordinatedモードでは、準備条件を満たして返すViewのonLayoutから呼びました。後者のコールバックは次のとおりです。

```js
() => {
  trace('content-layout', { mode, authReady });
  if (mode === 'coordinated') {
    trace('hide-request', { mode, authReady });
    void SplashScreen.hideAsync().then(() => trace('hide-result', { mode }));
  }
}
```

比較用アプリではmodeとauthReadyをルートのstateに持ち、このコールバックをViewのonLayoutへ渡します。実アプリで複数回のレイアウトを扱うなら、hideの再呼び出しを避ける条件も必要に応じて設けます。今回の比較は初回起動の順序に限定しました。

| 条件 | 記録された順番 | hideを呼んだ時点 |
| --- | --- | --- |
| early | font-ready → hide-request → hide-result → auth-ready → content-layout | authReadyはfalse |
| coordinated | font-ready → auth-ready → content-layout → hide-request → hide-result | authReadyはtrue |

HTTPで集めたログは到着順が一部入れ替わりました。表は各起動の通し番号で並べています。収集先への配送順を、アプリ内の実行順とはみなしていません。

## hideAsyncが解決しても、準備完了を証明しない

固定したexpo-splash-screenのJavaScript実装では、hideAsyncはhideを呼ぶラッパーです。フォントや認証処理のPromiseを受け取らず、その完了も待ちません。今回のearly条件でも、auth-readyより先にhide-resultが記録されました。

また、ViewのonLayoutはレイアウトの通知で、利用者に最初のフレームが見えた時刻そのものではありません。Macがロックされていたため、今回の試験ではネイティブ画面の目視確認やフレーム測定を行えませんでした。「白い画面が何秒なくなった」「すべての起動でちらつかない」とは結論していません。Androidも未検証です。

確認できた差は、hideの前にアプリ側の必要条件を揃えられるかどうかです。フォントの失敗をreadyとして扱うか、代替フォントやエラー画面を出すかも、表示方針として決めます。今回のfixtureはfontErrorでも待ちを終える構成ですが、実際の比較ではフォント読み込みが成功しました。

## 実アプリの認証ガードとは、適用範囲を分ける

circle-hubの固定commit `a34608c`にある[アプリ側レイアウト](https://github.com/takahiro-saeki/circle-hub/blob/a34608c611ded6549c1176a7977e68e1bc62a8db/apps/mobile/src/app/%28app%29/_layout.tsx)には、認証確認が終わるまでActivityIndicatorを返し、通知ハンドラの有効化も待つ実装があります。一方、確認したルートレイアウトに今回の手動hide制御はありません。

その実装が扱うのは通知遷移の競合です。今回の比較はスプラッシュを閉じる条件を扱います。既存アプリへ今回のViewやhide処理を適用した実績としては書いていません。認証ガードがすでに待機画面を返すなら、その画面を最初の表示内容として扱う選択肢もあります。

[比較用アプリ](https://github.com/takahiro-saeki/articles/tree/codex/article-stock-2026-09/experiments/article-stock-2026-09/mobile-batch15)とローカルcollectorを使えば、フォント、認証待ち、レイアウト、hideの記録を分けて確認できます。依存をlockfileから入れ、iOSのprebuildとPodsの導入後、ReleaseビルドをSimulatorへインストールする手順を実験READMEに残しました。クラウドビルド、ストア提出、外部配信は行っていません。

手動で閉じる制御を追加する前に、最初に見せる内容と、その内容に必要な待ちを決めます。hideを呼べたことではなく、その直前にどの準備が終わっていたかを記録すると、呼び出し条件を修正する根拠になります。
