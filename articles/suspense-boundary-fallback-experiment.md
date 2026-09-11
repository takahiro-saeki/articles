---
title: "Suspenseの境界を狭めると何が残るか。初回表示と再取得を5条件で比べる"
emoji: "🪟"
type: "tech"
topics: ["react", "typescript", "frontend"]
published: false
---

検索結果を読み込むたびに、見出しと入力欄まで消える。結果部分へ`Suspense`を移すと、この消え方は変えられます。ただし、すでに表示した結果を残すには、更新の優先度も関係します。

今回は境界の位置、Transition、keyを変えた5条件で、待機中に残るDOMを確認しました。**待機中も使いたい画面を境界の外へ置き、同じ対象の再取得では表示済み結果を残すか決めます**。

## 通信速度を変えず、待機状態を固定する

検証日は2026年9月11日。React / React DOM 19.2.5、esbuild 0.27.4、Node.js 24.15.0のproductionビルドを、Playwright CLI 0.1.19とHeadlessChrome 152.0.0.0で動かしました。ブラウザの版はUser-Agent表記です。React Compilerは使っていません。

検索APIの代わりに、外から解決できるPromiseを使います。Promiseはレンダーの外で一度作り、解決するまで同じインスタンスを渡します。

```tsx
type Gate = { version: number; promise: Promise<string>; resolve: () => void };
function makeGate(version: number): Gate {
  let resolve!: (value: string) => void;
  const promise = new Promise<string>(done => { resolve = done; });
  return { version, promise, resolve: () => resolve(`Result ${version}`) };
}
function Result({ gate }: { gate: Gate }) {
  return <p id="result">{use(gate.promise)}</p>;
}
```

`use`はPromiseの解決を待つ間、コンポーネントをsuspendさせます。同じPromiseを再利用する条件も[公式のuseの説明](https://react.dev/reference/react/use)にあります。毎回`use(fetch(...))`を作る例にはしていません。

手順は全条件で同じです。初回のPromiseを未解決にしてDOMを読む。解決して`Result 0`を表示し、入力欄へ`typed`を入力する。次の結果へ更新し、Promiseを解決する前のDOMを読む。最後に解決して`Result 1`を確認します。

この方法なら、通信が偶然早く終わってfallbackを見落とす問題を避けられます。一方、実通信、サーバーからのstreaming、画面のpaintやちらついた時間は測っていません。

## 初回表示では、Transitionでも残せる結果がない

広い境界では、見出し、入力欄、結果を含む`Shell`全体を囲みました。狭い境界では、`Shell`の内側で結果だけを囲みます。

```tsx
function Shell({ children }: { children: React.ReactNode }) {
  return <section id="shell"><h1>Search workspace</h1><input id="query" defaultValue="draft" />{children}</section>;
}
```

初回の待機中、広い境界はfallbackだけを表示しました。狭い境界は見出しと入力欄を表示し、その下にfallbackを出しました。後の更新にTransitionを使う設定でも、この初回の違いは同じです。

初回には前の検索結果がありません。「Transitionを使えば読み込み表示が出ない」とは言えません。最初から見せられる説明や操作まで消えるなら、まずその要素を境界の外へ出す余地を調べます。

境界は最も近い祖先のfallbackを使います。[Suspenseの公式説明](https://react.dev/reference/react/Suspense)でいう境界の粒度は、コンポーネントを細かく分割した数より、どの内容を一緒に見せるかに関係します。

## 再取得では、境界の位置と更新方法を組み合わせる

`Result 0`を表示した後に、未解決の`Result 1`へ更新した結果です。「旧結果」は実際に見えている文字列を指します。非表示のDOMが残っているだけなら表示中には数えていません。

| 条件 | 見出し・入力欄 | fallback | 旧結果 | pending表示 |
| --- | --- | --- | --- | --- |
| 広い境界、通常更新 | 非表示 | 表示 | 非表示 | idle |
| 狭い境界、通常更新 | 表示 | 表示 | 非表示 | idle |
| 広い境界、Transition | 表示 | 非表示 | Result 0 | pending |
| 狭い境界、Transition | 表示 | 非表示 | Result 0 | pending |
| 狭い境界、Transition、key変更 | 表示 | 表示 | 非表示 | idle |

通常更新で狭めた境界は、入力欄を残せました。結果そのものはfallbackへ置き換わります。検索条件を変えた直後に古い結果を見せたくない画面なら、この振る舞いも選択肢です。

安定した境界でTransitionを使うと、広い境界でも表示済みの画面を残せました。狭い境界との違いが消えたわけではなく、初回待機では引き続き差があります。

今回のTransitionは、Promiseを作った後、結果を選ぶstate更新だけを`startTransition`へ渡します。入力欄は非制御で、Transition対象にしていません。[useTransitionの公式説明](https://react.dev/reference/react/useTransition)にも、入力を制御するstate更新には使えないという制約があります。

## keyを変えると「前の結果を残す」の前提が変わる

最後の条件では、狭い`Suspense`のkeyを結果のversionにしました。Transitionを使っても、新しい境界がfallbackを表示しました。この時点のpending表示も`idle`です。したがって`isPending`を「アプリ内の通信がすべて終わったか」の判定には使えません。

同じ一覧の絞り込みなら、古い結果を薄く表示しながら更新中を伝える設計が考えられます。別の顧客や別の文書へ切り替えるなら、前の対象の情報を残すことが誤認を招く場合があります。その場合はkeyの変更で境界をリセットする意味があります。

この実験では入力欄をkey変更の外側に置きました。全条件で、再取得完了後の入力値は`typed`のままでした。広い境界の通常更新でも、今回の非表示は入力値の消去にはなっていません。「一瞬消えた」と「アンマウントされて状態を失った」は、別に確認する必要があります。

## 実画面へ戻すときの確認点

今回確認したのは、意図的に止めたPromiseとDOMの可視性です。動作コードと実行手順は[比較実験のソース](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/run-suspense-batch07.py)にあります。解決後は全条件で`Result 1`、fallbackなし、入力値保持を確認しています。

実際の画面では、使っているデータ取得ライブラリがSuspenseに対応しているかも必要です。Effect内で始める取得を、境界を足すだけで同じ動作にはできません。サーバー側のstreamingやルーターの遷移も、このブラウザ単体の実験とは別に確認します。

まず初回待機と再取得を分けて止める。次に、入力欄、結果、更新中表示がそれぞれどう見えるかを確かめる。この順序なら、境界を狭める変更で直せる消失と、古い結果を残すための更新設計を分けて判断できます。
