---
title: "AppStateのinactiveとbackgroundを、同じ復帰イベントとして扱わない"
tags:
  - ReactNative
  - Expo
  - iOS
  - Android
private: false
updated_at: null
id: null
organization_url_name: null
slide: false
ignorePublish: true
---

AppStateで復帰時の処理を書くなら、changeが返す状態と、Androidのfocus・blurイベントを分けて扱います。通知ドロワーを開いたことが、そのままbackgroundへの遷移になるわけではありません。

React Native 0.81.5のJavaScript実装へイベントを入力すると、blurとfocusのコールバックは呼ばれても、changeは呼ばれず、currentStateはactiveのままでした。復帰処理の条件にする前に、アプリの状態とAndroidの操作フォーカスのどちらが必要かを決めます。

## 状態名だけで、OS間のイベント列を揃えない

2026年9月11日に[AppStateの公式仕様](https://reactnative.dev/docs/appstate)を確認しました。activeは前面で動いている状態、backgroundは背面の状態です。inactiveはiOSにあり、前面と背面の遷移中や、一部のシステム操作でも現れます。

Androidにはchangeとは別にfocus・blurがあります。公式資料では、通知ドロワーを開く場合にAppState自体は変わらず、blurが発火する例を挙げています。inactiveがAndroidにも同じ意味で届くと想定すると、OSごとの復帰処理がずれます。

固定したネイティブソースも確認しました。iOSのRCTAppState.mmはUIApplicationの状態や通知をactive・background・inactiveへ対応付け、同じ状態の再送を抑えます。AndroidのAppStateModule.ktはonHostResumeをactive、onHostPauseをbackgroundへ対応付け、ウィンドウのフォーカス変更は別のイベントで送ります。ここにiOSのinactiveと同じ対応付けはありません。

これは、その版の実装と現在の説明を照合した結果です。全OSバージョンの実機で同じ操作を繰り返して得たイベント一覧ではありません。

## 実際のJavaScriptへ入力を変えて比較する

環境はmacOS 26.6.2、Node.js 24.15.0、Expo 54.0.33、React Native 0.81.5です。インストール済みのAppState.jsを読み込み、NativeEventEmitterとネイティブモジュールの境界だけを試験用に置き換えました。

| 入力 | 観測した結果 |
| --- | --- |
| 初期状態activeで、フォーカスfalse→true | blur 1回、focus 1回、change 0回、currentStateはactive |
| 状態イベントinactive→background→active | changeに同じ3値が届く |
| 状態イベントactiveを続けて送る | changeコールバックは2回呼ばれる |
| change購読をremoveした後にbackground | その購読は呼ばれず、currentState自体はbackgroundへ変わる |

同じactiveを送る試験で確認したのは、JavaScriptのchange購読が受け取った値を重複排除しないことです。iOSのネイティブ層が重複を抑える実装と矛盾しません。試験がネイティブ境界の後からイベントを入力しているためです。

起動時の値も比較しました。初期定数をnullにし、ネイティブの初期取得コールバックがactiveを返す条件では、changeにactiveが届きました。一方、取得の返答前にbackgroundイベントが来た場合、遅れて返るactiveでcurrentStateは上書きされませんでした。初期値の受信と、すでに届いた状態変更の競合を防ぐガードを確認できます。

公式資料のcurrentStateが起動時にnullになり得る説明は、legacy architectureを条件にしています。今回のnull入力はその分岐の試験であり、比較用のNew Architectureアプリが実際にnullで起動したという結果ではありません。

## 実装済みの復帰処理では、何を条件にしているか

circle-hubの固定commit `a34608c`にある[通知処理](https://github.com/takahiro-saeki/circle-hub/blob/a34608c611ded6549c1176a7977e68e1bc62a8db/apps/mobile/src/lib/push-notifications.ts)には、マウント時とactive受信時にバッジを消すeffectがあります。このeffectを実コードから抽出し、通知APIを代替して実行しました。

マウント直後に1回、inactive→background→activeを入力した後に合計2回、バッジ消去が呼ばれました。blurと、購読解除後の状態イベントでは増えませんでした。実バッジの表示・削除を確認した実験ではなく、effectが代替APIを呼ぶ条件の確認です。元のアプリは変更していません。

activeを受信する条件と、「前回backgroundだった場合だけ復帰扱いにする」条件は異なります。起動時の初期値通知やinactiveからの復帰も含めて処理したいなら、前者が候補になります。backgroundからの復帰だけに限定したいなら、直前の値を別に保持して比較する設計が必要です。どちらを選ぶかは、バッジ消去、データ再取得など、その処理が必要になる条件から決めます。

## 端末で観測するための小さな購読

比較用アプリで使用した購読部分です。traceは起動識別子、通し番号、値を記録する関数で、遷移やデータ取得は起こしません。AppStateはreact-nativeからimportし、ルートのeffect内に置きます。

```js
const state = AppState.addEventListener('change', value => trace('app-state', { value }));
```

effectのクリーンアップではstate.removeを呼びます。複数回マウントされる画面に購読だけ追加すると、同じイベントに対して処理が増えるため、登録と解除を対にします。

iOS 26.5 SimulatorのReleaseアプリでは、2回の起動時のcurrentStateはinactiveで、別アプリを起動した後にbackgroundが1回記録されました。Macがロックされ、前面へ戻る一巡の操作とログを確認できなかったため、これを通常の起動・復帰の完全なイベント列として掲載していません。Androidの通知ドロワー操作も実機では未確認です。

## 再現と、処理条件への反映

[実験コード](https://github.com/takahiro-saeki/articles/tree/codex/article-stock-2026-09/experiments/article-stock-2026-09)のmobile-batch15へ固定依存を入れ、リポジトリのルートから`node experiments/article-stock-2026-09/probe-mobile-js-batch15.mjs`を実行します。パッケージのJavaScriptと固定リポジトリのeffectを使います。OSがイベントを生成する部分や通知APIは代替しているので、端末での確認を済ませた扱いにはしません。

まずchange、focus、blurを別のログにし、必要な操作で実際にどれが来るかを確かめます。観測したイベントから、処理を実行する条件を選びます。データの再取得が重なる場合には、イベントの名前を変えるだけでなく、処理側の重複実行も制御する必要があります。今回の試験では、その制御の導入までは行っていません。
