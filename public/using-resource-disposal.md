---
title: "JavaScriptのusingは、returnや例外の後で何を解放するか。9条件で確認する"
tags:
  - JavaScript
  - Node.js
  - リソース管理
private: false
updated_at: null
id: null
organization_url_name: null
slide: false
ignorePublish: true
---

`using`は、解放用のメソッドを持つオブジェクトをスコープへ登録し、そこを抜けるときに後始末を呼ぶ構文です。複数のリソースを用意した場合は、取得した順と逆に解放されました。途中のreturnでも同じです。

Node.jsで9条件を試し、解放順、例外の残り方、非同期の待機まで確認しました。使う前に、どのオブジェクトがdisposeメソッドを持ち、どのスコープを抜けると解放されるかを確認します。

## returnより先に解放が終わる

次のコードを`.mjs`としてNode.js 24.15.0で実行しました。変換ツールやpolyfillは使っていません。

```js
const events = [];
function open(name) {
  events.push(`open:${name}`);
  return { [Symbol.dispose]() { events.push(`close:${name}`); } };
}
function work() {
  using first = open('A');
  using second = open('B');
  events.push('body');
  return 'done';
}
const value = work();
console.log(JSON.stringify({ value, events }));
```

結果は`value: "done"`、eventsは`open:A → open:B → body → close:B → close:A`でした。呼び出し元が戻り値を受け取った時点で、両方の解放が終わっています。

`open`は実験用のオブジェクトを返すだけです。`Symbol.dispose`メソッドの呼び出しを記録しており、ファイルや接続を開いたふりをした実測値ではありません。[ECMAScriptの宣言とスコープの仕様](https://tc39.es/ecma262/multipage/ecmascript-language-statements-and-declarations.html#sec-let-and-const-declarations)でも、usingで登録したリソースをスコープの処理終了時に解放する流れを確認できます。

通常終了に加え、途中の失敗も比較しました。

| 条件 | 確認できた順序・結果 |
| --- | --- |
| A、Bを取得して通常終了 | B、Aの順に解放 |
| Aを取得してreturn | Aを解放してから呼び出し元へ戻る |
| 本体でthrow | Aを解放してからcatchへ進む |
| A取得後、Bの取得がthrow | 登録済みのAを解放。Bの解放は呼ばれない |
| 本体とA・Bの解放がすべてthrow | 両方の解放を試し、例外をSuppressedErrorへ保持 |
| await usingでA、Bを登録 | Bの非同期解放の完了後にAを解放 |
| asyncDisposeだけの値をusingへ渡す | TypeError。非同期解放は呼ばれない |
| nullとundefinedをusingへ渡す | 解放メソッドなしで本体を実行 |
| 一時ディレクトリ内でthrow | catchへ進んだ後にはディレクトリが存在しない |

Bの取得そのものが失敗した場合、usingがBを後から解放するわけではありません。取得関数が内部で途中まで確保したものは、その関数側で後始末できる設計が必要です。

## 解放でも失敗したら、本体の例外はどこへ行くか

比較用のdisposeメソッドからもthrowさせました。本体が`body failed`、Bが`close failed:B`、Aが`close failed:A`を投げる条件です。

最後に捕まえた例外の`error.message`は`close failed:A`でした。ただし、本体の失敗が消えたわけではありません。

| 参照先 | 記録されたメッセージ |
| --- | --- |
| error.error.message | close failed:A |
| error.suppressed.error.message | close failed:B |
| error.suppressed.suppressed.message | body failed |

外側と内側のラッパーは`SuppressedError`です。解放中の失敗があっても残りの解放を試み、先に起きた例外を関連付けて保持していました。[明示的リソース管理の設計資料](https://github.com/tc39/proposal-explicit-resource-management#the-suppressederror-error)も、この例外の関係を説明しています。

ログを一番外側のmessageだけで済ませると、処理本体の失敗を見落とす可能性があります。今回の記録では`error`と`suppressed`をたどって、それぞれのメッセージを確認しました。

## 非同期の解放にはawait usingを使う

非同期版は`Symbol.asyncDispose`の開始と完了を別々に記録しました。`await using a = ...`、`await using b = ...`と登録すると、順序は`body → close start:B → close end:B → close start:A → close end:A → after work`でした。

この実験の待機は`Promise.resolve()`です。通信やディスクI/Oの所要時間を測ったものではありません。それでも、Bの解放完了を待ってからAを解放し、両方が終わってから呼び出し元が進む順序は確認できます。

`Symbol.asyncDispose`しか持たないオブジェクトを、awaitのないusingへ渡す比較ではTypeErrorになりました。非同期の処理を返す値なら、単にusingへ置けばよい、という使い方にはできません。

## Node.jsの一時ディレクトリでも確認する

ログ用オブジェクトだけでなく、実際に作った一時ディレクトリを使いました。

```js
import { existsSync, mkdtempDisposableSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let path;
try {
  using temporary = mkdtempDisposableSync(join(tmpdir(), 'article-using-example-'));
  path = temporary.path;
  writeFileSync(join(path, 'sample.txt'), 'fixture');
  console.log('inside:', existsSync(path));
  throw new Error('work failed');
} catch (error) {
  console.log('caught:', error.message);
}
console.log('after:', existsSync(path));
```

出力は`inside: true`、`caught: work failed`、`after: false`でした。`sample.txt`を含むディレクトリが、例外でスコープを抜けたときに削除されています。

[Node.js 24.15.0のmkdtempDisposableSync](https://nodejs.org/download/release/v24.15.0/docs/api/fs.html#fsmkdtempdisposablesyncprefix-options)が返すオブジェクトには、pathと削除用のdisposeメソッドがあります。このAPIは24.4.0で追加されたものです。任意のファイルパス文字列へusingを付けても、同じ削除処理が用意されるわけではありません。

検証日は2026年9月11日、Node.js 24.15.0、macOS arm64です。[9条件のコード](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/using-resource-disposal.mjs)と[結果](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/production/2026-09/batch-10/using-results.json)を保存しました。別のNode版、ブラウザー、変換後コード、プロセスの強制終了は検証していません。今回確認したのは、JavaScriptがスコープ退出の処理を実行できる状況での解放です。
