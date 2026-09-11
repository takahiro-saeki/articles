---
title: "useSyncExternalStoreで通知だけでは更新されない理由と、SSRの初期snapshotを確認する"
tags:
  - React
  - JavaScript
  - SSR
private: false
updated_at: null
id: null
organization_url_name: null
slide: false
ignorePublish: true
---

外部ストアが変更を通知しても、`useSyncExternalStore`を使った画面が変わらないことがあります。同じsnapshotオブジェクトを直接書き換えると、今回の実験では通知後も画面の値は`0`のままでした。

このHookを使うときに揃えるのは、購読の通知と、変更を表すsnapshotです。SSRではさらに、サーバーで描いた初期値をクライアントの最初の読み取りへ渡します。

## 通知した後もsnapshotの参照が同じだった

次のストアは、正しい置き換えと、比較用の直接変更を両方持つ実験用コードです。実アプリ用に`mutate`を推奨する例ではありません。

```js
export function createCounterStore(initial) {
  let snapshot = initial;
  const listeners = new Set();
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    replace(count) {
      snapshot = { count };
      for (const listener of listeners) listener();
    },
    mutate(count) {
      snapshot.count = count;
      for (const listener of listeners) listener();
    },
    listenerCount: () => listeners.size,
  };
}
```

`replace`は新しいオブジェクトを作り、`mutate`は元のオブジェクトの`count`だけを変えます。両方とも登録済みlistenerを呼びます。

画面側では、`useSyncExternalStore(store.subscribe, store.getSnapshot)`の戻り値から`count`を表示しました。

| 操作 | ストア内のcount | 画面のcount | 記録された表示用コンポーネントの値 |
| --- | --- | --- | --- |
| 初回 | 0 | 0 | 0 |
| 同じsnapshotをmutateして通知 | 1 | 0 | 追加の呼び出しなし |
| 新しいsnapshotへreplaceして通知 | 2 | 2 | 2が追加 |

通知が届いたかだけを調べても、この違いは見つかりません。`getSnapshot`の戻り値を`Object.is`で比較したときに変化を表せるかが必要です。[公式リファレンス](https://react.dev/reference/react/useSyncExternalStore)は、変更がない間は同じsnapshotを返し、変更があれば新しい不変のsnapshotを返す契約を説明しています。

直接変更した後は、親の別のstate更新などによる再描画を挟まずに観測しました。別のきっかけで再描画された場合の表示は、この比較では確認していません。

逆に、読むたびに新しいオブジェクトを作る`getSnapshot`もこの契約を満たしません。公式資料は無限の更新につながる例として説明していますが、この実験ではそのループを実行していません。変更時に作ったsnapshotを次の変更まで再利用する作りを確認しています。

## 購読解除までをストア側の契約にする

`subscribe`はlistenerの追加だけでなく、削除する関数も返します。実験ではmount後の購読数が1、unmount後は0でした。

同じストアの`subscribe`関数を毎回使う構成にしています。描画のたびに購読関数を作り直す場合の登録し直しや、複数の購読者を持つ大規模ストアの性能は測っていません。

## SSRでは、現在値とは別に初期値を揃える

サーバーでは`renderToString`で次のHTMLを生成しました。

```html
<output id="store-count">0</output>
```

クライアント側のストアの現在値は、意図的に`1`へ進めています。サーバーで使った初期値`{ count: 0 }`を`window.__BOOTSTRAP__`へ渡し、hydrationの間だけそれを読みます。

```jsx
import React from 'react';
import { hydrateRoot } from 'react-dom/client';
import { createCounterStore, StoreCounter } from './external-store.mjs';
const bootstrap = window.__BOOTSTRAP__;
const store = createCounterStore({ count: 1 });
const record = { serverSnapshots: [], renders: [], errors: [] };
function getServerSnapshot() {
  record.serverSnapshots.push(bootstrap.count);
  return bootstrap;
}
const root = hydrateRoot(document.getElementById('root'),
  <StoreCounter store={store} getServerSnapshot={getServerSnapshot} rendered={value => record.renders.push(value)} />,
  { onRecoverableError(error) { record.errors.push(error.message); } });
window.readHydration = () => ({ ...record, count: document.getElementById('store-count')?.textContent, subscribers: store.listenerCount() });
window.unmountHydration = () => root.unmount();
```

`record`と`rendered`は観測用です。snapshotの読み取りとコンポーネント呼び出しを記録し、`onRecoverableError`で不一致を検出しました。HTMLや初期データは固定した数値だけで、ユーザーデータの埋め込み例ではありません。

| クライアントへ渡す初期値 | コンポーネントが読んだcountの順 | hydrationの不一致 |
| --- | --- | --- |
| サーバーと同じ0 | 0 → 1 | なし |
| サーバーと違う2 | 2 → 1 | あり |

正しい初期値では、最初にサーバーと同じ値を読み、その後にクライアントストアの現在値へ進みました。最終表示だけを見ると両方とも`1`なので、不一致を見逃します。ここでは描画途中の呼び出しを記録したのであって、`0`が何フレーム見えたかは測っていません。

`getServerSnapshot`を省いて同じコンポーネントを`renderToString`すると、初期snapshotが必要だというエラーがthrowされました。[SSRの公式説明](https://react.dev/reference/react/useSyncExternalStore#adding-support-for-server-rendering)では、サーバーとhydration時に同じデータを返すことが必要とされています。

## 値の保存場所を置き換えるHookではない

この例で値を保存しているのは`createCounterStore`です。Hookは購読とsnapshotをReactへ接続します。アプリ内部だけで完結するstateを、すべてこのストアへ移す実験ではありません。

検証日は2026年9月11日、React / React DOM 19.3.0、Node.js 24.15.0、esbuild 0.28.2、macOS arm64、Headless Chrome 152です。通知比較はproduction、hydration比較は開発buildで、Strict ModeとReact Compilerは使っていません。サーバー描画はNode.jsの`renderToString`です。並行レンダリング中のtearingやストリーミングSSRは検証範囲に含めていません。

[ストアと表示用コンポーネント](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/react-batch09/external-store.mjs)、[SSR入力](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/react-batch09/render-ssr.mjs)、[ブラウザ結果](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/production/2026-09/batch-09/browser-results.json)を残しました。通知、snapshotの参照、サーバー初期値のどこが変わったかを別々に追えます。
