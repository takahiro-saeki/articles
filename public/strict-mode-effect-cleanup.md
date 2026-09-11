---
title: "Strict ModeでEffectが二度動く条件を、購読のsetupとcleanupで確認する"
tags:
  - React
  - JavaScript
  - useEffect
private: false
updated_at: null
id: null
organization_url_name: null
slide: false
ignorePublish: true
---

Strict ModeでEffectのsetupが2回記録されたときは、間にcleanupがあるかと、最後に残った購読数を確認します。setupの回数だけを1回へ抑えても、後始末ができているとは限りません。

React 19.3.0の開発buildとproduction buildで、小さな購読処理を比較しました。root全体をStrict Modeで囲むか、一部だけを囲むかでも、初回の挙動が分かれました。

## 外部通信を使わず、登録と解除を数える

検証用の購読先はSetです。handlerを登録し、ローカルのボタンを押すと登録中のhandlerを呼びます。ネットワーク接続や通知サービスは使っていません。

```jsx
function Subscription({ room, cleanup }) {
  useEffect(() => {
    const handler = () => trace.events.push(`message:${room}`);
    trace.active.add(handler);
    trace.events.push(`setup:${room}`);
    if (cleanup) {
      return () => {
        trace.active.delete(handler);
        trace.events.push(`cleanup:${room}`);
      };
    }
  }, [room, cleanup]);
  return <output id="room">{room}</output>;
}
```

`trace.active`は登録中のhandler、`trace.events`は順序付きログです。正常版は`cleanup: true`、後始末を省いた比較用の版は`false`にします。roomはAからBへ変更でき、最後にrootをunmountします。

開発用とproduction用のbundleは`process.env.NODE_ENV`を分けて作成しました。root全体を囲む条件では、`createRoot`から描画する要素を`<StrictMode>`で包みます。一部だけの条件では、Strict Modeなしの親の下にある`Subscription`だけを包みました。

## 初回のsetupとcleanupは、配置によって違った

| buildと配置 | 初回setup回数 | 初回cleanup回数 | 初回処理後に残るhandler |
| --- | --- | --- | --- |
| 開発、rootにStrict Mode、cleanupあり | 2 | 1 | 1 |
| 開発、Strict Modeなし、cleanupあり | 1 | 0 | 1 |
| 開発、子だけStrict Mode、cleanupあり | 1 | 0 | 1 |
| production、rootにStrict Mode、cleanupあり | 1 | 0 | 1 |
| 開発、rootにStrict Mode、cleanupなし | 2 | 0 | 2 |

正常な開発rootの初回ログは、`setup:A → cleanup:A → setup:A`でした。余分なsetupの前に、前の購読を解除できています。

[Strict Modeの公式説明](https://react.dev/reference/react/StrictMode)は、開発時の追加setup・cleanupと、rootを囲まない場合には初回Effectの追加実行をしない条件を区別しています。ログを読むときも、Strict Modeの配置を確認してから、Effectが2回動いた理由を調べます。

なお、表で数えているのはEffectの処理です。コンポーネント関数の呼び出し回数や、DOMの描画回数をこの表から推定していません。

## cleanupを外すと、同じ操作でhandlerが増えた

初回にローカル通知ボタンを1回押すと、正常版では`message:A`が1件、cleanupなし版では2件でした。次にroomをBへ変えます。

| 開発rootの条件 | 初回登録後 | room変更後 | unmount後 |
| --- | --- | --- | --- |
| cleanupあり | 1 | 1 | 0 |
| cleanupなし | 2 | 3 | 3 |

正常版はroom変更時に`cleanup:A → setup:B`、unmount時に`cleanup:B`を記録しました。cleanupなし版ではAのhandlerが残ったままBのhandlerが増え、unmountしてもSetに残りました。

解除処理を省くと何が残るかを、同じ条件で比較しています。実験ごとにSetを捨てているので、この不正な版を実アプリへ残してはいません。

## 回数を抑える前に、対になる処理を確認する

このケースの修正点は、登録したhandlerと同じものをcleanupで取り除くことです。roomが変われば古いroomの購読を外し、次のroomを登録します。[useEffectの公式リファレンス](https://react.dev/reference/react/useEffect)でも、依存が変わると前の値でcleanupした後に次のsetupを行う流れを説明しています。

APIへの書き込み、決済、メール送信などをこの追加実行の例へそのまま当てはめた検証はしていません。今回の再現対象は、登録と解除が対になる購読処理です。実際のログが違う場合は、Strict Modeの配置だけでなく、本当のunmount・再mountや開発ツールの更新による再実行も切り分ける必要があります。

検証日は2026年9月11日、React / React DOM 19.3.0、Node.js 24.15.0、esbuild 0.28.2、macOS arm64、Headless Chrome 152です。React Compilerは使っていません。[実験コード](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/react-batch09/effects.jsx)と[5条件の結果](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/production/2026-09/batch-09/browser-results.json)に、初回だけでなくroom変更・unmountまでのログを残しました。
