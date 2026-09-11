---
title: "Next.jsのImageはどの画像を取得するか。src・srcset・currentSrcを実ブラウザーで比べる"
tags:
  - Next.js
  - 画像
  - フロントエンド
private: false
updated_at: null
id: null
organization_url_name: null
slide: false
ignorePublish: true
---

`Image`が出力した`src`だけを見ても、実際にダウンロードされた画像の幅は分かりませんでした。今回、`src`が幅3840を指す画像でも、ブラウザーの`currentSrc`は幅640を指していました。

img属性から候補を調べ、ブラウザーが選んだURLと、そのレスポンスを確認します。普通のimgとNext.jsのImageを、同じ合成画像で比較しました。

## CSSの表示幅を同じにする

元画像は1600×1000のPNGです。同じピクセル列を別のファイル名で保存し、画像同士でURLのキャッシュを共有しないようにしています。写真の圧縮率を代表する入力ではなく、規則的な色の変化を持つ検証用パターンです。

ページは次の構成です。

```jsx
import Image from 'next/image';
const responsiveStyle = { display: 'block', width: '50vw', height: 'auto' };
export default function Page() {
  return <main>
    <img id="plain" src="/plain.png" alt="Plain test pattern" width={320} height={200} style={responsiveStyle} />
    <Image id="fixed" src="/fixed.png" alt="Fixed candidates" width={320} height={200} style={responsiveStyle} />
    <Image id="responsive" src="/responsive.png" alt="Responsive candidates" width={320} height={200} sizes="50vw" style={responsiveStyle} />
    <div style={{ height: 10000 }} />
    <section id="lazy-pair">
      <img id="lazy-plain" src="/lazy-plain.png" alt="Native lazy test" width={320} height={200} loading="lazy" />
      <Image id="lazy-next" src="/lazy-next.png" alt="Next lazy test" width={320} height={200} />
    </section>
  </main>;
}
```

上の3枚はCSSで幅50vw、高さautoです。属性として渡したwidthは320ですが、ブラウザーの表示幅はviewportに応じて変わります。残りの2枚は下方へ離して置き、遅延読み込みを比較します。

検証したviewportは1280×720、devicePixelRatioは1でした。上の3枚の実際の表示幅は、いずれも640でした。

## srcとcurrentSrcは違うことがある

| 画像 | sizes | srcsetの形式 | 実際のcurrentSrcが指す幅 |
| --- | --- | --- | --- |
| 普通のimg | なし | なし | 元画像1600 |
| Image、sizesなし | なし | 384を1x、640を2x | 384 |
| Image、sizesあり | 50vw | 384wから3840wの候補 | 640 |

sizesなしのImageは、渡したwidthをもとに密度用の候補を出していました。CSSで表示幅を640へ広げても、この入力では幅384の候補を選びました。

sizesありのImageは、viewportと`50vw`から選べる幅用の候補を出しています。今回選んだURLは`/_next/image?url=%2Fresponsive.png&w=640&q=75`でした。一方、同じimgのsrc属性は`w=3840`です。

[Imageのsizesリファレンス](https://nextjs.org/docs/app/api-reference/components/image#sizes)は、sizesによって候補生成の形式が変わることと、CSSで画像を可変幅にする場合にsizesを指定することを説明しています。JSXにwidthを書いたことと、CSSで表示する幅、ブラウザーへ伝えたsizesが一致しているかを確認します。

この比較はDPR 1と1種類のviewportだけです。別の画面幅、DPR、ブラウザーでも同じ候補を選ぶという結果ではありません。

## 選んだURLから何が返ったか

ブラウザーが選んだcurrentSrcを、画像形式を指定したAcceptヘッダーで再GETし、レスポンスのContent-Typeと本文byte数を記録しました。画像の最適化設定は既定値です。

| 画像 | Content-Type | レスポンス本文byte数 |
| --- | --- | --- |
| 普通のimg、元PNG | image/png | 494961 |
| sizesなし、幅384 | image/webp | 926 |
| sizesあり、幅640 | image/webp | 1842 |

これはHTTPで取得した本文のサイズです。リクエスト・レスポンスヘッダーを含む通信量でも、体感速度でもありません。ブラウザーのResource Timingでも、2つの最適化画像のencodedBodySizeがそれぞれ926と1842であることを確認しました。

合成PNGは圧縮しやすいパターンなので、この差を普通の写真へ当てはめた圧縮率にはしません。画質、LCP、最適化サーバーのCPU時間は測っていません。幅384の方が小さいから常に適切、という結論にもなりません。表示幅との対応も含めて見る必要があります。

## lazyはImageだけの機能ではない

下方の2枚は、上の画像群から高さ10000の空白を挟んで置きました。普通のimgには`loading="lazy"`を付け、Imageはloadingを指定していません。

初期表示時は、両方ともnaturalWidthが0でcurrentSrcは空でした。対象sectionまでスクロールして待つと、両方の画像が読み込まれました。Imageが生成したimgにも`loading="lazy"`がありました。

[loadingの公式説明](https://nextjs.org/docs/app/api-reference/components/image#loading)では、Imageの既定値はlazyです。今回の比較からも、遅延読み込みだけを目的に普通のimgとImageを区別する必要はありません。一方、普通のimgへloadingを書かない上段の例と、属性を指定した下段の例は別条件です。

何px近づいた時点で取得を始めるかは測っていません。今回確認したのは、初期位置では読み込まず、対象へスクロールした後に読み込んだことです。

検証日は2026年9月11日。Next.js 16.3.4、インストールしたReact / React DOM 19.3.0、Node.js 24.15.0、macOS arm64、Headless Chrome 152です。webpackのproduction buildとローカルのnext startで実行しました。外部画像、custom loader、unoptimized、preload、CDNは比較していません。[パターン生成と検証コード](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/run-next-batch10.py)、[属性・URL・レスポンスの記録](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/production/2026-09/batch-10/image-results.json)を保存しています。
