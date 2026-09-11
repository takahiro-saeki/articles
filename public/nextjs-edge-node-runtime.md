---
title: "Next.jsのEdgeとNode.jsを同じ処理で比べる。build成功と実行成功は分けて確認する"
tags:
  - Next.js
  - Node.js
  - JavaScript
private: false
updated_at: null
id: null
organization_url_name: null
slide: false
ignorePublish: true
---

runtimeの互換性は、importが通るかだけでなく、HTTPリクエストでその処理を実行できるかまで確認します。Next.js 16.3.4では、Edge側の`eval`を含むルートはbuildに成功しましたが、呼び出すと500になりました。

なお、今回の版では`runtime = 'edge'`に非推奨警告が出ます。[公式の移行案内](https://nextjs.org/docs/messages/edge-runtime-deprecated)はruntime指定を削除し、既定のNode.jsを使う方法を示しています。この記事は新規採用を勧める比較ではなく、既存コードの互換性を確認するための実験です。

## Web APIだけの処理を両方で実行する

最初は、queryから文字列を取り、UTF-8のbyte数とSHA-256を返す処理です。

```js
export async function webResponse(request) {
  const text = new URL(request.url).searchParams.get('text') ?? '';
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const hex = Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, '0')).join('');
  return Response.json({ text, bytes: data.length, sha256: hex });
}
```

これを別々のRoute Handlerから呼び、一方を`runtime = 'nodejs'`、もう一方を`runtime = 'edge'`にしました。`?text=fixture`を送ると、どちらも200で、textは`fixture`、bytesは`7`、SHA-256は同じ値でした。ハッシュはPython側でも計算して照合しています。

Request、URL、TextEncoder、Web Crypto、Responseだけで書いた今回の処理は、両方で実行できました。[Edge RuntimeのAPI一覧](https://nextjs.org/docs/app/api-reference/edge)には、これらのWeb APIが記載されています。

この成功を、任意のnpmパッケージも動くという結論にはしません。ルートと、そのimport先が使うAPIを確認します。

## import先でファイルを読む処理を追加する

次は、プロジェクト内の合成テキスト`fixture.txt`を読む関数です。

```js
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
export async function readFixture() {
  return (await readFile(join(process.cwd(), 'fixture.txt'), 'utf8')).trim();
}
```

Node.jsのルートから呼ぶと、`local fixture only`を返して200になりました。同じ関数をEdgeのルートからimportした版はbuildに失敗し、`node:fs/promises`と`node:path`のUnhandledSchemeErrorを記録しました。

エラーのimport traceは、Nodeのmoduleから`lib/node-file.js`を経てRoute Handlerへ続いています。エラーが出たファイル名だけでなく、どの依存を通じて読み込んだかを追えます。

この場合、import文の見た目をES Modulesへ揃えるだけでは解決しません。依存先がNodeのファイルAPIを使うことは変わらないためです。実験では別のpolyfillや外部ストレージへの置き換えは行っていません。

## buildは通っても、実行時に止まる例

Edge側で次のコードも試しました。外部入力をevalへ渡すコードではなく、固定した式だけの比較です。

```js
export const runtime = 'edge';
export function GET() { return Response.json({ value: eval('1 + 2') }); }
```

production buildはexit 0でした。その後に`next start`で起動してGETすると、500と`Internal Server Error`が返りました。サーバーログの例外は`EvalError: Code generation from strings disallowed for this context`です。

Node.js側で同じ式を使ったルートは、200で`value: 3`を返しました。今回の6条件を並べると、失敗を検出した段階が違います。

| 処理 | runtime | build | HTTP実行 |
| --- | --- | --- | --- |
| Web APIで文字列をhash化 | Node.js | 成功 | 200 |
| Web APIで文字列をhash化 | Edge | 成功・非推奨警告 | 200 |
| NodeのファイルAPI | Node.js | 成功 | 200 |
| 同じ関数をimportしてファイル読込 | Edge | 失敗 | 実行なし |
| 固定式のeval | Node.js | 成功 | 200、value 3 |
| 固定式のeval | Edge | 成功・非推奨警告 | 500、EvalError |

[Edgeの未対応APIの説明](https://nextjs.org/docs/app/api-reference/edge#unsupported-apis)は、NodeのネイティブAPIや動的コード生成の制約を記載しています。ただし、この表のように、すべての違反をbuildが同じ段階で検出するわけではありません。

## runtimeの名前から実行場所や速さを推測しない

検証日は2026年9月11日。Next.js 16.3.4、インストールしたReact / React DOM 19.3.0、Node.js 24.15.0、macOS arm64です。webpackのproduction build、`cacheComponents: false`、React Compilerなしで、ローカルの`next start`を使いました。

クラウドのリージョン配置、cold start、DB接続、ISR、ストリーミング、他社のWorkers環境は測っていません。この結果からEdgeの方が速い、Nodeなら任意の接続先へアクセスできる、といった判断はできません。

[処理本体](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/next-batch10/lib/web-response.js)、[HTTP結果](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/production/2026-09/batch-10/runtime-http-results.json)、[build・実行時の失敗記録](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/production/2026-09/batch-10/negative-build-results.json)を保存しました。既存のEdge指定を整理するときも、使っているAPIと依存先を確認し、実際のリクエストまで通して判断します。
