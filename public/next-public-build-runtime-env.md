---
title: "NEXT_PUBLICは起動時に変わるか。同じNext.js buildを別の環境変数で動かして確認する"
tags:
  - Next.js
  - 環境変数
  - JavaScript
private: false
updated_at: null
id: null
organization_url_name: null
slide: false
ignorePublish: true
---

`NEXT_PUBLIC_`の値を変更してサーバーを起動し直しても、今回のブラウザー表示はbuild時の値のままでした。一方、動的に描画するServer Componentが読んだサーバー用の値は、起動時の環境変数へ変わりました。

同じ`process.env`でも、値が決まる時点を確認する必要があります。1回作ったNext.js 16.3.4のbuildを、異なる2つの環境で起動して比較しました。

## build時と起動時の値を分ける

使った値はすべて、この実験用の公開可能な文字列です。

| 時点 | ARTICLE_SERVER_LABEL | NEXT_PUBLIC_ARTICLE_LABEL |
| --- | --- | --- |
| build | server-build-A | public-build-A |
| 起動B | server-runtime-B | public-runtime-B |
| 起動C | server-runtime-C | public-runtime-C |

Bを終了してからCを起動し、途中でbuildし直していません。両方のBUILD_IDが一致することも確認しました。`.env`の優先順位を比較する実験ではなく、プロセスへ値を明示して渡しています。

[環境変数の公式説明](https://nextjs.org/docs/app/guides/environment-variables#bundling-environment-variables-for-the-browser)は、直接参照した公開環境変数をbuild時に埋め込むことと、build後の値が固定されることを説明しています。今回も公開値を変えたのは起動時だけです。

## Server Componentでも静的描画なら値が残った

まず、動的描画を指定しないページです。

```jsx
export default function Page() {
  return <pre id="env-result">{JSON.stringify({
    server: process.env.ARTICLE_SERVER_LABEL,
    public: process.env.NEXT_PUBLIC_ARTICLE_LABEL,
  })}</pre>;
}
```

このページはbuildで事前生成されました。BでもCでも、serverは`server-build-A`、publicは`public-build-A`です。サーバー用の環境変数であっても、build中に読んでHTMLへ出した値は、その生成結果へ残ります。

比較用ページは、読む前に`connection()`を待ちます。

```jsx
import { connection } from 'next/server';
export default async function Page() {
  await connection();
  return <pre id="env-result">{JSON.stringify({
    server: process.env.ARTICLE_SERVER_LABEL,
    public: process.env.NEXT_PUBLIC_ARTICLE_LABEL,
  })}</pre>;
}
```

こちらはBで`server-runtime-B`、Cで`server-runtime-C`になりました。ただし、publicはどちらも`public-build-A`のままです。

| 表示場所 | 起動Bのserver | 起動Cのserver | 両起動時のpublic |
| --- | --- | --- | --- |
| 事前生成したページ | server-build-A | server-build-A | public-build-A |
| connection後に読むページ | server-runtime-B | server-runtime-C | public-build-A |

[実行時環境変数の説明](https://nextjs.org/docs/app/guides/environment-variables#runtime-environment-variables)も、サーバーの動的描画で値を読む方法を示しています。

このコードは観測のためにserverの値も画面へ表示しています。`NEXT_PUBLIC_`を付けなければ、JSXやレスポンスへ出した値も秘密のままになる、という意味ではありません。ここに実際の秘密情報は使っていません。

## ブラウザー内で読み方を変える

Client ComponentではuseEffectの中で読み、サーバー側の初期描画と混同しないようにしました。欠けている値は結果のJSONから消さず、nullへ揃えます。

```jsx
'use client';
import { useEffect, useState } from 'react';
export default function Page() {
  const [values, setValues] = useState(null);
  useEffect(() => {
    const key = 'NEXT_PUBLIC_ARTICLE_LABEL';
    const env = process.env;
    setValues({ direct: process.env.NEXT_PUBLIC_ARTICLE_LABEL,
      dynamic: process.env[key] ?? null, alias: env.NEXT_PUBLIC_ARTICLE_LABEL ?? null,
      server: process.env.ARTICLE_SERVER_LABEL ?? null });
  }, []);
  return <pre id="env-result">{JSON.stringify(values)}</pre>;
}
```

実ブラウザーでuseEffect後の表示を読みました。

| 読み方 | 起動B | 起動C |
| --- | --- | --- |
| process.env.NEXT_PUBLIC_ARTICLE_LABEL | public-build-A | public-build-A |
| process.env[key] | null | null |
| env.NEXT_PUBLIC_ARTICLE_LABEL | public-build-A | public-build-A |
| process.env.ARTICLE_SERVER_LABEL | null | null |

間接参照なら常に同じ結果になる、とも言えませんでした。公式ページには、変数名やprocess.envの別名を経由する参照はインライン化されない例があります。しかし、この版・このソースの別名参照は`public-build-A`になっています。

そこで、ブラウザーに渡されたchunkも確認しました。`direct`と`alias`には文字列リテラル`"public-build-A"`が入り、`dynamic`にはブラウザー側のenvを読む式が残っていました。[生成コードの記録](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/production/2026-09/batch-10/client-bundle-evidence.json)で照合できます。どの内部最適化がこの変換を担当したかまでは特定していません。

確認できたのは、この書き方で起動時の`public-runtime-B`や`public-runtime-C`をブラウザーへ渡せなかったことです。別名や動的キーを、実行時設定を注入する仕組みの代わりにはしません。

## 同じbuildを配るなら、値を渡す場所を決める

今回の直接参照した公開値はbuildで固定されました。サーバー用の値は動的描画で読めますが、ブラウザーが必要とする起動時設定を、この実験では自動的に受け取れていません。

同じbuildを複数環境へ配り、クライアントの設定も変えたい場合は、公開してよい値をサーバーのレスポンスなどから明示して渡す設計が候補です。この記事ではそのAPIを実装していないため、認証やキャッシュまで含めて動作確認済みとは扱いません。

検証日は2026年9月11日。Next.js 16.3.4、インストールしたReact / React DOM 19.3.0、Node.js 24.15.0、macOS arm64、Headless Chrome 152です。webpackのproduction build、`cacheComponents: false`、React Compilerなし。CDN、Docker、クラウド環境へは配布していません。[再現コード](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/run-next-batch10.py)と[同じbuildのB・Cの結果](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/production/2026-09/batch-10/next-env-results.json)を保存しました。
