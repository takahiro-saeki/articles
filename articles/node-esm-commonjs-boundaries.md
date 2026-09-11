---
title: "ESMとCommonJSが混ざったら、Node.jsの判定と読み込み方法を分けて調べる"
emoji: "📦"
type: "tech"
topics: ["nodejs", "javascript", "esm", "commonjs"]
published: false
---

Node.jsで`require is not defined`を見て`import`へ直したら、今度は別のファイルで構文エラーになる。ESMとCommonJSが混在すると、構文の修正だけでは原因を追いにくくなります。

調べる順序は、まず「このファイルはどちらとして解釈されるか」、次に「相手をどの方法で読み込むか」です。この二つを分けると、`package.json`の変更、拡張子の変更、非同期読み込みへの変更を選びやすくなります。

Node.js `v24.15.0`で、小さなファイルを別プロセスから実行する10ケースを確認しました。bundler、TypeScript変換、独自loaderは使っていません。`NODE_OPTIONS`も子プロセスでは外しています。公式資料は2026年9月11日に確認し、最新版の表示は`v26.8.2`でした。実験結果はあくまで`v24.15.0`のものです。

## 最初に、拡張子と最寄りのpackage.jsonを見る

[Node.jsのPackages公式説明](https://nodejs.org/api/packages.html)では、`.mjs`はESM、`.cjs`はCommonJSです。`.js`は最も近い親の`package.json`の`type`で明示できます。

この「最も近い」が効くため、リポジトリのルートだけを見ても判定できない場合があります。実験では、`type: module`のディレクトリの中に、`type: commonjs`を持つ子ディレクトリを作りました。

```text
esm/
  package.json            type: module
  require.js
  legacy.cjs
  nested/
    package.json          type: commonjs
    legacy.js
```

`require.js`の中で`require()`を呼ぶと失敗しますが、`legacy.cjs`と`nested/legacy.js`では`typeof require`が`function`になりました。外側がESMの領域でも、拡張子や内側の設定によってCommonJSとして解釈できます。

逆方向も確認しています。`type: commonjs`の中にある`.js`へ静的な`export`を書くと構文エラーになり、同じ領域の`.mjs`なら実行できました。

## 設定がないjsを、必ずCommonJSだとは考えない

`type`を書かなければ昔と同じCommonJSになる、という理解も現在のNode.jsでは不十分です。公式資料には、判定が明示されていない入力にESM専用の構文があると、構文検出によってESMとして扱う動作が説明されています。

実験では、空の`package.json`を置いたディレクトリで次の`.js`を実行しました。

```js
export const value = 42;
console.log(value);
```

結果は`42`で、`MODULE_TYPELESS_PACKAGE_JSON`の警告も出ました。同じ`export`でも、明示した`type: commonjs`の中では失敗し、`type`がない場合は構文検出で成功しています。

警告を消そうとして`type: module`を追加すると、同じ領域にある従来の`.js`も影響を受けます。先に対象ファイルと、その設定を共有するファイルを確認します。局所的な移行なら`.mjs`や`.cjs`で意図を明示する選択肢もあります。

なお、構文検出に伴う性能差は測っていません。この記事で確認したのは、実行の成否と警告です。

## requireでESMを読める場合もある

「CommonJSからESMへは必ず`import()`」という古い説明も、そのまま現在の環境へ当てはめられません。[検証版に対応したCommonJSの公式資料](https://nodejs.org/download/release/v24.15.0/docs/api/modules.html)では、`require()`から同期的なESMを読める条件が説明されています。

実験で読み込むESMは次の内容です。

```js
export const value = 42;
```

CommonJS側からは、名前付きexportを返されたオブジェクトから読みました。

```js
console.log(require("../esm/sync.mjs").value);
```

結果は`42`でした。`.mjs`という拡張子を見ただけで、`require()`が必ず拒否すると判断することはできません。

一方、対象を次のようにすると、同じ環境でも`require()`は`ERR_REQUIRE_ASYNC_MODULE`で失敗しました。

```js
await Promise.resolve();
export const value = 42;
```

違いはtop-level awaitです。公式資料では、読み込むモジュール自身だけでなく、依存先のモジュールグラフにtop-level awaitがある場合も、この同期読み込みの対象外です。今回の実験では読み込み先自身へawaitを置いて確認しています。

## dynamic importは呼び出し元をESMへ変えない

CommonJSのファイルから、先ほどの非同期ESMを読みました。

```js
import("../esm/async.mjs").then(m => console.log(typeof require, m.value));
```

出力は`function 42`です。ESMの準備を待って値を取得でき、呼び出し元には引き続き`require`があります。`import()`を一つ書いたことで、CommonJSファイル全体がESMへ切り替わったわけではありません。

ただし、同期的に返していた処理を`import()`へ置き換えるなら、その結果を待つ必要があります。読み込み箇所だけ書き換えても、呼び出し元が以前と同じ同期インターフェースで使えるとは限りません。設定の変更で済む問題か、非同期の境界が必要な問題かを分けます。

## ファイルの判定が合っていても、パス解決で失敗する

ESMの相対importで`./sync`と書いたケースは、`sync.mjs`が隣にあっても`ERR_MODULE_NOT_FOUND`になりました。[ESMの公式説明](https://nodejs.org/api/esm.html)では、相対・絶対指定のimportに拡張子が必要です。

これは読み込み先のファイルがESMかCommonJSかとは別の問題です。今回なら`./sync.mjs`まで指定する必要があります。bundlerで省略できた書き方が、Node.jsへ直接渡したときも動くとは限りません。

確認した10ケースを並べると、次のようになります。

| 条件 | 結果 |
| --- | --- |
| `type: module`内の`.js`でrequire | `require is not defined` |
| `type: commonjs`内の`.js`で静的export | 構文エラー |
| `type: module`内の`.cjs` | CommonJSとして実行 |
| `type: commonjs`内の`.mjs` | ESMとして実行 |
| 内側に`type: commonjs`を置いた`.js` | 内側の設定で実行 |
| CommonJSから同期ESMをrequire | 値を取得 |
| CommonJSからtop-level await付きESMをrequire | `ERR_REQUIRE_ASYNC_MODULE` |
| CommonJSから同じESMをimport() | 値を取得、requireも存在 |
| ESMの相対importで拡張子を省略 | `ERR_MODULE_NOT_FOUND` |
| typeなしの`.js`へexportを書く | 構文検出で実行、警告あり |

[再現コード](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/node-module-boundaries.mjs)は一時ディレクトリを作り、全ケースの終了値と出力をassertしてから削除します。既存プロジェクトの`package.json`を変えずに確認できます。

パッケージの`exports`による条件分岐、CommonJSの名前付きexport検出、TypeScriptの設定は今回の対象外です。混在時のエラーを調べる入口として、実行するNode.jsの版、対象ファイルの判定、読み込み方法、相対パスの順に確認します。
