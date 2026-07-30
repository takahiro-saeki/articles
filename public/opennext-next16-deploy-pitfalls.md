---
title: Next.js 16をOpenNextでCloudflare Workersにデプロイして踏んだハマりどころ3つ
tags:
  - cloudflare
  - CloudflareWorkers
  - Next.js
  - OpenNext
  - TypeScript
private: false
updated_at: ''
id: null
organization_url_name: null
slide: false
ignorePublish: false
posting_campaign_uuid: null
agreed_posting_campaign_term: false
---

自作のNext.jsアプリ(App Router、APIルート+D1)を@opennextjs/cloudflareでCloudflare Workersにデプロイしました。基本の手順は公式ドキュメント通りで動くのですが、途中で3つほど「ドキュメントに書いていない壁」を踏んだので、実際のエラーと一緒に記録しておきます。

先にデプロイの基本形だけ書いておくと、こうです。

```bash
npm i @opennextjs/cloudflare@latest
npm i -D wrangler@latest
# wrangler.jsonc と open-next.config.ts を用意して
npx opennextjs-cloudflare build
npx opennextjs-cloudflare deploy
```

## ハマり1: Next.js 16.2.10だけが弾かれる

`@opennextjs/cloudflare` をインストールしようとした瞬間にpeer dependencyで落ちました。

```
npm error Could not resolve dependency:
npm error peer next@">=15.5.21 <16 || >=16.2.11" from @opennextjs/cloudflare@1.20.2
```

使っていたのはNext.js 16.2.10。要求は `>=16.2.11`。**パッチバージョン1つ分だけ足りない**という嫌な引っかかり方です。バージョン指定を見ると16系は16.2.11以降だけが許可されていて、16.2.10はピンポイントで除外されています。

対処はNext.jsのパッチアップデートです。

```bash
npm i next@16.2 eslint-config-next@16.2
```

`--legacy-peer-deps` で無理やり通す手もありますが、アダプタ側が意図して除外しているバージョンを使う理由はないので、素直に上げるのが正解だと思います。

## ハマり2: wrangler typesの生成型がDOM型と衝突する

D1バインディングに型を付けようと `wrangler types` を実行したら、アプリ全体で `request.json()` の戻り値がunknownになりました。

```
error TS18046: 'body' is of type 'unknown'.
error TS2339: Property 'name' does not exist on type 'object'.
```

原因は、生成される `worker-configuration.d.ts` にWorkersランタイムのグローバル型(`Request` / `Response` / `Body` など)が丸ごと含まれていて、Next.jsが前提とするDOM libと同じ名前を再定義してしまうことです。

これは対処の分量が多いので別記事に切り出しましたが、要点だけ書くと「生成をやめて、`import type` で必要な型だけ取り込む手書きd.tsを置く」で解決します。

```ts
// cloudflare-env.d.ts(手書き)
import type { D1Database, Fetcher } from "@cloudflare/workers-types";

declare global {
  interface CloudflareEnv {
    DB: D1Database;
    ASSETS: Fetcher;
  }
}

export {};
```

## ハマり3: デプロイ直後だけ404と「error code: 1042」が返る

デプロイが成功してURLが表示されたのでcurlで確認したところ、404が返ってきました。ボディはCloudflareのエラーで、

```
error code: 1042
```

とだけ書いてあります。1042はWorkerが自分自身のホスト名へサブリクエストを投げたときにブロックされるエラーで、「OpenNextのアセット取得が壊れたか?」と一瞬焦りました。

結論としては**待てば直ります**。デプロイ直後の数十秒〜数分だけ、エッジへの伝播が終わっていない状態でこのエラーが出るようで、少し待って再アクセスしたら全ルートが200になり、以降は一度も再発していません。HEADリクエストは200なのにGETだけ404、という不思議な状態も伝播中は起きました。

デプロイ直後の疎通確認で404を見ても、すぐに原因調査を始めず、まず1〜2分待って再確認するのをおすすめします。これを知らないと、正常なデプロイをロールバックしかねません。

## その他の細かいメモ

- `wrangler.jsonc` の `compatibility_flags` に `nodejs_compat` が必要です(OpenNextの要件)
- ローカル検証は `opennextjs-cloudflare preview` よりも、buildした上で `wrangler dev` を叩く方がWorkersランタイムの挙動をそのまま確認できて安心でした
- D1を使う場合、`next dev` でもローカルD1を使えるようにする `initOpenNextCloudflareForDev()` をnext.config.tsに入れておくと、開発と本番のコードパスが揃います

## まとめ

| ハマり | 症状 | 対処 |
|---|---|---|
| peer dependency | 16.2.10だけ除外されている | Next.jsを16.2.11+へ |
| wrangler types | `json()` がunknownになる | import typeの手書きd.ts |
| エラー1042 | デプロイ直後だけ404 | 1〜2分待つ |

どれも分かってしまえば数分の話ですが、初見だと調査に時間を食うタイプの問題でした。Next.js on Workersはこの3つを越えれば快適です。

## 環境

- Next.js 16.2 / @opennextjs/cloudflare 1.20 / wrangler 4.113
- Cloudflare Workers + D1
