---
title: wrangler typesが生成する型はNext.jsのDOM型と衝突する。回避策はimport typeの手書きd.ts
tags:
  - cloudflare
  - wrangler
  - Next.js
  - TypeScript
  - CloudflareWorkers
private: false
updated_at: ''
id: null
organization_url_name: null
slide: false
ignorePublish: true
posting_campaign_uuid: null
agreed_posting_campaign_term: false
---

Next.jsアプリを@opennextjs/cloudflareでCloudflare Workersにデプロイする構成で、D1バインディングの型を付けようと `wrangler types` を実行したところ、アプリ側のTypeScriptが大量のエラーで壊れました。

```
error TS18046: 'body' is of type 'unknown'.
error TS2339: Property 'name' does not exist on type 'object'.
```

`request.json()` の戻り値が突然unknownになる、というのが症状の中心です。私の環境では、wranglerが生成するランタイム型とNext.jsのDOM型が同じプロジェクトへ入ったことが原因でした。最終的には生成をやめ、`import type` だけの手書きd.tsを置いて解決しました。バージョンやtsconfigの対象範囲によって挙動は変わるため、ここでは発生した構成と回避策を記録します。

## 何が起きたか

`wrangler types` は既定で `worker-configuration.d.ts` を生成します。この中にはバインディングの `Env` インターフェースだけでなく、**Workersランタイムの完全な型定義**が含まれています。`Request` や `Response`、`Body` といったグローバル型がまるごと入っている、ということです。

Workersランタイムの型では `Body#json()` の戻り値が `Promise<unknown>` です。一方、Next.jsが前提とするDOMのlib(lib.dom.d.ts)では `Promise<any>` です。生成されたランタイム型がグローバルに合流した結果、Route Handler内の `await request.json()` が全部unknown扱いになり、`body.name` のようなアクセスが軒並み型エラーになりました。

Workers専用プロジェクトなら正しい型付けですが、Next.jsアプリはDOM libと共存する必要があります。この2つは同じグローバル名を再定義し合う関係なので、素直に混ぜると壊れます。

## 試したこと: --include-runtime=false

wranglerにはランタイム型を除外するオプションがあります。

```bash
wrangler types cloudflare-env.d.ts --env-interface CloudflareEnv --include-runtime=false
```

これで生成されるのはenvインターフェースだけになります。

```ts
// 生成された cloudflare-env.d.ts
interface CloudflareEnv {
  DB: D1Database;
  ASSETS: Fetcher;
}
```

一見良さそうですが、今度は別のエラーが出ます。

```
error TS2552: Cannot find name 'D1Database'. Did you mean 'IDBDatabase'?
```

`D1Database` や `Fetcher` はランタイム型が定義するグローバル名です。私の構成では、ランタイム型を入れるとDOM型と衝突し、除外すると生成物が参照する型を解決できませんでした。

## 解決策: import typeだけの手書きd.ts

発想を変えて、生成をやめて手書きにしました。ポイントは `@cloudflare/workers-types` を**グローバルに導入せず、import typeで必要な型だけ取り込む**ことです。

```bash
npm i -D @cloudflare/workers-types
```

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

これで解決です。仕組みを分解すると:

- `import type` で取り込んだ型は**そのファイルのスコープに閉じる**ので、Workers版の `Request` / `Response` がグローバルへ漏れない。DOM libと衝突しない
- `declare global` で `CloudflareEnv` だけをグローバルに公開する。@opennextjs/cloudflareの `getCloudflareContext()` は `env` をこの `CloudflareEnv` 型として返すため、これだけで `env.DB` に型が付く
- この例では `import type` があるためファイルはモジュールとして扱われる。末尾の `export {}` は明示のために置いているが、必須ではない

利用側は普通に補完が効きます。

```ts
import { getCloudflareContext } from "@opennextjs/cloudflare";

function getDb() {
  return getCloudflareContext().env.DB; // D1Database と推論される
}
```

## トレードオフ

手書きにした代償として、**バインディングを追加したら自分でd.tsも更新する**必要があります。`wrangler types` の「wrangler.jsoncから自動生成」という利点は捨てることになります。

ただ、個人開発規模だとバインディングが変わる頻度は低く(このアプリではD1が1つとassetsだけ)、1ファイル数行の手動管理で困っていません。バインディングが多い大規模構成なら、生成した `CloudflareEnv` から参照される型名だけimport typeに書き換えるスクリプトを挟む手もあると思います。

## まとめ

- `wrangler types` の生成物はWorkersランタイムのグローバル型を含み、Next.jsのDOM libと衝突する(`json()` がunknownになったらこれ)
- 私の構成では `--include-runtime=false` だけでは参照先の型を解決できなかった
- `import type` + `declare global` の手書きd.tsなら、グローバルを汚さずバインディングにだけ型が付く

Workers専用プロジェクトでは起きない問題なので情報が少なく、原因の切り分けに少し時間を使いました。同じ構成(Next.js on Workers)の方の時短になれば幸いです。

## 環境

- @opennextjs/cloudflare 1.20 / wrangler 4.113 / @cloudflare/workers-types 5.x
- Next.js 16(App Router)。Next.js 15でも同じ構造の問題が起きるはずです
