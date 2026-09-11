---
title: "Next.jsのMiddlewareをProxyへ移す。名前の変換後にmatcherとruntimeを確認する"
tags:
  - Next.js
  - JavaScript
  - 移行
private: false
updated_at: null
id: null
organization_url_name: null
slide: false
ignorePublish: true
---

MiddlewareをProxyへ移すときは、ファイル名と関数名を変えた後で、通るリクエストとruntimeを確認します。Next.js 16.3.4のcodemodは今回の最小例を変換できましたが、Proxyへruntime指定を残す比較用コードはbuildに失敗しました。

この記事では、レスポンスへ観測用ヘッダーを付ける小さな例を移行します。実サービスの認証処理を移した事例ではありません。

## なぜProxyという名前になったか

[公式の移行説明](https://nextjs.org/docs/app/api-reference/file-conventions/proxy#migration-to-proxy)は、Express.jsのmiddlewareとの混同を避け、アプリに到達する前のネットワーク境界としての役割を示すための改名と説明しています。Next.js 16からの変更です。

名前だけを手掛かりに、汎用的な処理をすべてここへ集める設計にはしません。今回も、ルート処理そのものと、ルートへ進む前のヘッダー付与を分けて動きを見ます。

## codemodで変わったところを見る

入力の`middleware.js`は、`middleware`という名前の関数をexportし、`/protected/:path*`をmatcherに持つだけのコードです。実験用コピーへ`@next/codemod` 16.3.4の`middleware-to-proxy`を実行しました。

変換後の`proxy.js`は次のとおりでした。

```js
import { NextResponse } from 'next/server';
export function proxy(request) {
  const response = NextResponse.next();
  response.headers.set('x-article-proxy', request.nextUrl.pathname);
  return response;
}
export const config = { matcher: ['/protected/:path*'] };
```

元ファイルがなくなり、関数名が`proxy`へ変わったことを確認しています。ヘッダーを設定する処理とmatcherは、そのまま残りました。この例ではログイン判定やリダイレクトを追加していません。

ファイルの配置はappと同じ階層です。変換結果と変換前のコードは[記録](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/production/2026-09/batch-10/proxy-codemod.json)で比較できます。変換後も、アプリに必要な挙動を確認します。

## matcherはHTTPリクエストで確かめる

変換後のコードでproduction buildを作り、ローカルの`next start`へリクエストしました。ルート側はGETを受けてpathを返します。観測用ヘッダーがあるかを、HTTPステータスとは別に記録しました。

| リクエスト | ステータス | x-article-proxy |
| --- | --- | --- |
| GET /protected | 200 | /protected |
| GET /protected/a/b | 200 | /protected/a/b |
| GET /protected?x=1 | 200 | /protected |
| GET /protectedness | 404 | なし |
| GET / | 200 | なし |
| GET /plain.png | 200 | なし |
| POST /protected | 405 | /protected |

`/protectedness`は文字列の先頭が似ていても、今回のmatcherでは対象になりませんでした。queryを付けた場合、ヘッダーへ入れたpathnameは`/protected`です。

POSTはProxyを通りましたが、ルートにPOST handlerがないため405でした。Proxyを通ることと、ルートがそのmethodを処理できることを分けて確認できます。

この7条件は対象ルートとその近くのpathを確認するための入力です。全URL、prefetch、basePath、locale、書き換え後の経路を網羅したものではありません。[matcherのリファレンス](https://nextjs.org/docs/app/api-reference/file-conventions/proxy#matcher)で形式を確認したうえで、アプリに必要なリクエストを追加します。

## Proxyにruntime指定を残すとどうなるか

別の実験用コピーでは、このProxyへ`export const runtime = 'edge'`を追加しました。buildはexit 1で失敗し、Proxyではroute segment configを使えず、Node.js runtimeで動くというエラーを記録しました。

[Proxyのruntime仕様](https://nextjs.org/docs/app/api-reference/file-conventions/proxy#runtime)にも、runtimeオプションを設定できないことが示されています。名前がProxyになったことから、以前のEdge前提をそのまま引き継いでよいとは判断できません。

今回のエラーは、認証ライブラリや実際の通信の互換性を検証した結果ではありません。移行するコードにruntime依存のAPIがある場合は、変換後のbuildとリクエスト処理を別途確認する必要があります。

検証日は2026年9月11日。Next.jsとcodemodは16.3.4、React / React DOMのインストール版は19.3.0、Node.jsは24.15.0、macOS arm64です。webpackのproduction build、`cacheComponents: false`、React Compilerなし、ローカルNodeサーバーで確認しました。[再現コード](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/run-next-batch10.py)と[HTTP結果](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/production/2026-09/batch-10/proxy-http-results.json)を保存しています。クラウドへのデプロイや実アプリの移行は行っていません。
