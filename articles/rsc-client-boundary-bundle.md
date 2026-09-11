---
title: "Client境界を増やすとbundleは増えるか。境界1か所と2か所を実際に比べる"
emoji: "📦"
type: "tech"
topics: ["nextjs", "react", "frontend", "performance"]
published: false
---

`'use client'`を減らせばJavaScriptも減る、とは限りません。今回、ページ全体を一つのClient Componentにした構成より、二つのボタンを別々のClient Componentにした構成のほうが、初回HTMLから読み込むJavaScriptは22,883 bytes少なくなりました。

違いを作ったのは境界の数ではなく、カタログを描画するコードとデータをclient側へimportしたかどうかです。さらに、Server Componentとして描画した構成はHTMLが増えました。JavaScriptだけを見て通信量全体の削減とは判断できません。

## 同じ画面を三つの構成で作る

対象は256件の公開用の合成カタログと、独立してカウントが増える二つのボタンです。カタログ名には連番と決定的に生成したSHA-256文字列を含めました。実ユーザーのデータでも、実プロジェクトの負荷分布でもありません。

| 構成 | Clientの入口 | カタログの作り方 |
| --- | ---: | --- |
| broad | 1モジュール | Client ComponentがCatalogをimport |
| leaves | 2モジュール | ServerのPageがCatalogを描画。ボタンだけClient |
| slot | 1モジュール | ServerのPageがCatalogを描画し、ClientのFrameへchildrenで渡す |

数えているのは、このページのために設けたClientの入口となるモジュールです。Next.js内部のClient Component数や、画面に置かれたインスタンス総数ではありません。

leavesのPageは次のコードです。CounterAとCounterBにはそれぞれ`'use client'`があり、Catalogにはありません。

```jsx
import CounterA from '../../../components/counter-a';
import CounterB from '../../../components/counter-b';
import Catalog from '../../../components/catalog';
export default function Page() {
  return <main><h1>Catalog</h1><CounterA /><CounterB /><Catalog /></main>;
}
```

`'use client'`はimportの依存関係に境界を作ります。client側の入口からCatalogをimportすると、その先で読むデータもclientの依存になります。名前がCatalogであることや、そのファイル自身にdirectiveがないことは、server側に残る根拠にはなりません。[Next.jsのServer / Client Componentsの説明](https://nextjs.org/docs/app/getting-started/server-and-client-components)と照合しました。

## production buildの何を数えたか

2026年9月11日にNext.js 16.3.4、Node.js 24.15.0で`next build --webpack`を実行しました。`cacheComponents: false`、React Compilerなしの構成です。

依存としてインストールしたReact / React DOMは19.2.5ですが、App Router用にNext.jsが同梱する実装は`19.3.0-canary-cbb046ab-20260731`でした。バージョンはパッケージ指定だけで判断せず、同梱モジュールも確認しています。

三つのrouteを同じアプリでbuildし、各初回HTMLの`script src`を重複なく取得しました。共通runtimeも含む、実際のファイルの非圧縮サイズです。gzip列はPythonで各ファイルを個別に再圧縮した合計で、実ネットワークのtransfer sizeではありません。

| 構成 | JS非圧縮 bytes | JS gzip bytes | HTML非圧縮 bytes | HTML gzip bytes |
| --- | ---: | ---: | ---: | ---: |
| broad | 581,755 | 181,794 | 25,984 | 12,550 |
| leaves | 558,872 | 170,154 | 58,819 | 20,438 |
| slot | 558,817 | 170,183 | 58,617 | 20,222 |

これは初回HTMLが参照するscript群の比較です。遅延import後の全コード、別routeを巡回した後のキャッシュ、source map、CDNの圧縮方式は含めていません。ビルドによるchunk分割が変われば数値も変わります。

Playwrightでカタログの全256行とボタンの初期表示が同一であることを確認しました。各ボタンを押すと、それぞれ`A: 1`、`B: 1`になります。表示や操作を削った結果ではありません。

## 減った依存をchunkの中で確かめる

webpackのmodule情報には、broadから取り込まれたCatalogと生成データがありました。さらに、取得したJSファイル内の最後のカタログ名に対応する識別文字列を調べると、broadに存在し、leavesとslotには存在しませんでした。

leavesは入口を増やしても、一覧の描画にしか使わないデータをclientのimportから外せました。逆に、小さなClient Componentを大量に作れば必ず小さくなるという証拠でもありません。今回は二つの単純なボタンに限った比較です。

HTMLの増加も確認が必要です。Server側でカタログを描画すると、結果の要素はHTMLやRSCの表現として届きます。データが通信から消えるわけではありません。今回の三つのHTMLにはどれもカタログがあり、leavesとslotではRSC側の表現を含むHTML全体が大きくなりました。

JavaScriptの転送や実行を減らすことと、すべてのレスポンスを合計して小さくすることは、測る対象が異なります。この実験はhydration時間や入力遅延を測っていないため、表示が何倍速くなったという数字も出していません。

## Clientの親へ渡すときは、importとchildrenを分けて読む

slotのPageは、Server側でCatalogの要素を作ってからFrameへ渡します。

```jsx
import Frame from '../../../components/frame';
import Catalog from '../../../components/catalog';
export default function Page() { return <Frame><Catalog /></Frame>; }
```

Frameはclient側で二つのボタンのstateを持ち、受け取ったchildrenを配置します。Frame自身からCatalogをimportする構成とは違います。画面上の親子関係だけで「Clientの下は全部client」と判断すると、この違いを見落とします。

一方、ServerからClientへ渡すpropsにはシリアライズ可能性の制約があります。[use clientのAPI説明](https://nextjs.org/docs/app/api-reference/directives/use-client)も確認し、任意の通常関数や秘密値を渡せるという説明にはしていません。今回扱ったカタログは、ブラウザに表示してよい合成データです。

slotとleavesのJS差は非圧縮で55 bytesでした。gzipでは大小が逆転しています。この小差を設計の優劣には使いません。Frameが本当に一覧全体の操作を担うならslot、各ボタンが独立しているならleavesというように、必要な状態の所有者から選べます。

## 自分の画面で比べるとき

[比較アプリ](https://github.com/takahiro-saeki/articles/tree/codex/article-stock-2026-09/experiments/article-stock-2026-09/next-batch07)と[取得・検証スクリプト](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/run-next-batch07.py)に、依存の固定値と合成データを残しています。

同じ表示と操作を保ったまま、clientの入口がimportする依存を見ます。重い処理をserver側へ移したら、JSから消えたことに加え、HTMLやRSCへ何が移ったかも数えます。境界の個数は、この確認を省くための指標にはなりません。
