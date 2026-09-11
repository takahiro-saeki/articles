---
title: "Reactのkeyをindexにすると入力欄はどうずれるか。値の持ち主を分けて再現する"
tags:
  - React
  - JavaScript
  - フロントエンド
private: false
updated_at: null
id: null
organization_url_name: null
slide: false
ignorePublish: true
---

Reactのリストで先頭の行を削除したとき、入力値は残った行に付いてくるでしょうか。indexをkeyにした場合は、値を誰が持つかで結果が変わりました。

DOMが値を持つuncontrolled inputと、行コンポーネントがstateを持つ入力では、別の行の値が表示されました。親のstateから値を渡す入力は正しい表示になりましたが、DOM node自体は別の行へ使い回されていました。

## 既存コードから、再現する条件を絞る

個人開発の[日程追加画面](https://github.com/takahiro-saeki/circle-hub/blob/770de5f2989775cfd95f7a9c4529565a2b48d2fd/apps/web/src/app/%28app%29/organizations/%5Bid%5D/schedules/new/page.tsx)には、`rows.map`の`idx`を`Card`のkeyへ渡す実装があります。行の削除は配列のfilter、途中への複製は配列の結合で行います。

ただし、タイトル入力は`value={row.title}`を受け取るcontrolled inputでした。このコードからは、運用中に入力値が入れ替わる不具合が起きたかまでは確認できません。対象commitは`770de5f`です。関連履歴と設計資料も確認したうえで、行の削除と入力値の所有者だけを取り出した実験にしました。実アプリの変更やデータ送信は行っていません。

## 先頭を消すと、indexの対応がずれる

A、B、Cの3行を用意し、Bだけを`edited-B`へ書き換えてからAを削除します。Bを編集して単に逆順にするだけでは、3行の中央にあるBが動かないため、今回は削除を使いました。

```jsx
import React, { useState } from 'react';

const initialRows = [
  { id: 'A', title: 'Alpha' },
  { id: 'B', title: 'Beta' },
  { id: 'C', title: 'Gamma' },
];
function Row({ row, mode, update }) {
  const [localTitle, setLocalTitle] = useState(row.title);
  const props = mode === 'uncontrolled'
    ? { defaultValue: row.title }
    : mode === 'local'
      ? { value: localTitle, onChange: event => setLocalTitle(event.target.value) }
      : { value: row.title, onChange: event => update(row.id, event.target.value) };
  return <label data-row={row.id}>{row.id}<input {...props} /></label>;
}
export function KeyExperiment({ keyMode, mode }) {
  const [rows, setRows] = useState(initialRows);
  function update(id, title) {
    setRows(previous => previous.map(row => row.id === id ? { ...row, title } : row));
  }
  return <section>
    <button id="remove-first" onClick={() => setRows(previous => previous.slice(1))}>Remove first</button>
    {rows.map((row, index) => (
      <Row key={keyMode === 'index' ? index : row.id} row={row} mode={mode} update={update} />
    ))}
  </section>;
}
```

`mode`は`uncontrolled`、`local`、`parent`の3種類、`keyMode`は`index`と`id`です。`local`は`useState(row.title)`で行ごとに初期化し、`parent`は親の配列をIDで更新します。

各inputのDOM nodeと削除前の行IDをWeakMapへ記録し、削除後の値とnodeの出自を比較しました。これは実験用の観測で、Reactの内部keyを読み出しているわけではありません。

| 値の所有者 | key | 削除後のB / Cの値 | B / Cに使われたnodeの元の行 |
| --- | --- | --- | --- |
| DOM | index | Alpha / edited-B | A / B |
| DOM | id | edited-B / Gamma | B / C |
| 行のstate | index | Alpha / edited-B | A / B |
| 行のstate | id | edited-B / Gamma | B / C |
| 親のstate | index | edited-B / Gamma | A / B |
| 親のstate | id | edited-B / Gamma | B / C |

index版では、削除後のBがkey `0`、Cがkey `1`になります。削除前には、それぞれAとBに対応していたkeyです。`defaultValue`や行のstate初期値が、新しい行へ毎回適用されるわけではありません。

ID版では、位置が変わってもBはkey `B`のままです。編集済みの値とDOM nodeが同じ行へ残りました。[Reactのリストkeyの説明](https://react.dev/learn/rendering-lists#keeping-list-items-in-order-with-key)でも、削除・挿入・並べ替えの際に同じ項目を対応付ける役割が示されています。

## controlledならkeyを気にしなくてよい、とは言えない

親が値を管理する版では、Reactが新しい`row.title`をinputへ渡すので、今回の表示は正しくなりました。今回の6条件から、indexを使うと必ず値が壊れるとは結論できません。

一方、WeakMapで調べたnodeの出自はA / Bでした。値が正しいことだけでは、行とコンポーネントやDOMの同一性が保たれた証拠になりません。今回、フォーカスやIME入力、DatePickerの内部状態は測っていません。それらが実アプリで壊れたという主張にも広げません。

行を追加・削除する設計なら、データ側に行のIDを持たせ、行が存続する間は同じIDをkeyに使う方が意図を表せます。保存前の行にも作成時にIDを付け、複製を別の行として扱うなら新しいIDを付ける設計が候補です。描画するたびにIDを生成する方式は、安定した対応付けにはなりません。これは既存画面への導入提案で、適用済みの修正ではありません。

検証は2026年9月11日、React / React DOM 19.3.0、Node.js 24.15.0、esbuild 0.28.2、macOS arm64、Headless Chrome 152で行いました。production build、Strict Modeなし、React Compilerなしです。[最小コード](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/react-batch09/keys.jsx)と[6条件の結果](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/production/2026-09/batch-09/browser-results.json)で、表示値とDOM nodeを別々に追えます。
