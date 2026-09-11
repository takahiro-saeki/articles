---
title: "Reactのcallback refが返すcleanupを、同じDOMの再描画と型検査で確かめる"
tags:
  - React
  - TypeScript
  - JavaScript
private: false
updated_at: null
id: null
organization_url_name: null
slide: false
ignorePublish: true
---

Reactのcallback refは、DOM nodeを受け取るだけでなく、解除時に呼ぶcleanup関数を返せます。React 19で追加されたこの仕組みを、ResizeObserverの登録と解除で確認しました。

見たいのはunmountだけではありません。同じDOM nodeが残っていても、渡すcallbackの参照が変わると、前のcleanupと次の登録が動きました。

## observerを作ったcallbackから解除関数を返す

次の関数は、callback refと観測用ログを作ります。`legacy: false`ならcleanupを返し、`true`ならnullを受け取ったときに解除します。

```jsx
function makeTrackedRef(legacy) {
  let observer;
  function disconnect() {
    observer.disconnect();
    trace.active.delete(observer);
    trace.events.push('cleanup');
  }
  return node => {
    if (node === null) {
      trace.events.push('null');
      if (observer) disconnect();
      return;
    }
    observer = new ResizeObserver(() => {});
    observer.observe(node);
    trace.active.add(observer);
    trace.events.push('attach');
    if (!legacy) return disconnect;
  };
}
```

実際にブラウザのResizeObserverを作り、対象nodeをobserveしています。`trace.active`には未解除として記録しているobserverを入れます。サイズ変更通知の回数は今回の比較対象にしていません。

同じcallbackを保つ版と、描画のたびに作り直す版を比べました。

```jsx
export function RefExperiment({ stable, legacy }) {
  const [tick, setTick] = useState(0);
  const stableRef = useMemo(() => makeTrackedRef(legacy), [legacy]);
  const ref = stable ? stableRef : makeTrackedRef(legacy);
  return <section>
    <button id="rerender" onClick={() => setTick(previous => previous + 1)}>Render {tick}</button>
    <div id="observed" ref={ref}>Observed node</div>
  </section>;
}
```

ボタンを押すと親が再描画されますが、対象の`div`は同じnodeのままです。最後にrootをunmountし、解除まで確認しました。

## 同じnodeでもcallbackを変えると解除される

| build・callbackの作り方 | 初回ログ | 再描画で追加されたログ | unmountで追加されたログ |
| --- | --- | --- | --- |
| production、同じcallback、cleanupを返す | attach | なし | cleanup |
| production、新しいcallback、cleanupを返す | attach | cleanup → attach | cleanup |
| production、同じcallback、nullで解除 | attach | なし | null → cleanup |
| 開発root Strict Mode、同じcallback、cleanupを返す | attach → cleanup → attach | なし | cleanup |
| 開発root Strict Mode、新しいcallback、cleanupを返す | attach → cleanup → attach | cleanup → attach | cleanup |
| 開発root Strict Mode、同じcallback、nullで解除 | attach → null → cleanup → attach | なし | null → cleanup |

6条件とも、初回処理後と再描画後の未解除observer数は1、unmount後は0でした。callbackを作り直す版でもcleanupが対になっているので、今回の実装ではobserverが増え続けませんでした。

[callback refの公式説明](https://react.dev/reference/react-dom/components/common#ref-callback)も、返したcleanup関数を解除時に呼ぶこと、callbackが変わる場合の解除・再登録、開発時の追加サイクルを区別しています。cleanupを返した版では、今回のログにnull呼び出しはありません。null側でも同じ解除が重ねて来ると期待しないようにします。

再描画前後でnode参照を直接比較し、同じDOMを維持したことを確かめました。callbackの実行回数と、DOMが作り直されたかどうかは分けて調べます。

## 値を暗黙に返すと型エラーになる場合がある

型でも違いを確認しました。TypeScript 7.0.2、`@types/react` 19.3.0、strictと`react-jsx`を使っています。

```tsx
import React from 'react';
const nodes = new Map<string, HTMLDivElement | null>();
export const view = <div ref={node => nodes.set('preview', node)} />;
```

`Map.set`はMapを返すため、このcallbackはvoidやcleanup関数を返す型へ適合せず、TS2322になりました。また、cleanupを`() => nodes.delete('preview')`と書いた版も、booleanを返すためTS2322です。

次のようにブロックを使い、cleanupから値を返さない版は通りました。

```tsx
import React from 'react';
const nodes = new Map<string, HTMLDivElement>();
export const view = <div ref={node => {
  if (!node) return;
  nodes.set('preview', node);
  return () => { nodes.delete('preview'); };
}} />;
```

この型の比較は[React 19の移行ガイド](https://react.dev/blog/2024/04/25/react-19-upgrade-guide#ref-cleanups-required)でも説明されている変更に対応します。Mapへの格納が目的なら、その戻り値をref callbackの戻り値へ流さない書き方にします。

## 無限ループの対策とcleanupの確認は分ける

既存の記事では、画像プレビューのref callbackからstateを更新し続ける循環を扱いました。今回はstate更新をobserver callbackへ入れず、callbackの同一性と解除タイミングを比較しています。cleanupを返せば、任意のstate更新ループも解消するという検証ではありません。

検証日は2026年9月11日、React / React DOM 19.3.0、Node.js 24.15.0、esbuild 0.28.2、macOS arm64、Headless Chrome 152です。React Compilerは使っていません。production側にもStrict Modeのラッパーを付けて比較しましたが、開発時の追加サイクルは起きませんでした。observerの数は実験側の登録・解除記録で、ブラウザ内部のリソース使用量を測った値ではありません。

[実験コード](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/react-batch09/refs.jsx)、[6条件のログ](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/production/2026-09/batch-09/browser-results.json)、[型検査3条件](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/production/2026-09/batch-09/ref-type-results.json)を残しました。refの動きを調べるときは、nodeが変わったかと、callbackの参照が変わったかを分けて確認できます。
