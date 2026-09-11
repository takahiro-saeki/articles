---
title: "AbortControllerでタイマーを止める。開始前・待機中・完了後の7条件を確認する"
tags:
  - JavaScript
  - Node.js
  - 非同期処理
private: false
updated_at: null
id: null
organization_url_name: null
slide: false
ignorePublish: true
---

`AbortController`はfetch専用ではありません。ただし、`abort()`を呼べば任意のPromiseが止まるわけでもありません。処理側がsignalを受け取り、待機の解除とPromiseのrejectを実装する必要があります。

タイマーを使う小さな関数で、開始前、待機中、完了後のキャンセルを比べました。確認したかったのは、rejectされたかだけでなく、完了後にabortリスナーが残らないかです。

## キャンセルを受け取るdelayを作る

`cancellable-delay.mjs`として次の関数を用意しました。これは今回の検証用実装で、既存アプリへ導入済みのコードではありません。

```js
export function delay(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    const cleanup = () => signal.removeEventListener('abort', onAbort);
    const onAbort = () => {
      clearTimeout(timer);
      cleanup();
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      cleanup();
      resolve('finished');
    }, ms);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}
```

signalがすでにabortedなら、その理由で即座にrejectします。まだならタイマーとabortリスナーを登録します。中断時は`clearTimeout`し、リスナーを外してrejectします。

通常完了側でもリスナーを外します。`{ once: true }`が外すのはabortイベントが発生した後なので、正常終了した処理の後始末をそれだけに任せません。

[DOM仕様のキャンセル可能なAPIの要件](https://dom.spec.whatwg.org/#using-abortcontroller-and-abortsignal-objects-in-apis)には、開始時にすでに中断されているsignalを確認し、未完了の処理を中断理由でrejectする流れが定義されています。この関数もその流れに沿わせています。

## 同じsignalで複数のタイマーを止める

同じディレクトリへ次の実行例を置きます。

```js
import { delay } from './cancellable-delay.mjs';

const controller = new AbortController();
const group = Promise.allSettled([
  delay(10000, controller.signal),
  delay(10000, controller.signal),
]);
const reason = new Error('screen closed');
controller.abort(reason);
const results = await group;
console.log(results.map(result => result.status));
console.log(results.every(result => result.reason === reason));
```

出力は`[ 'rejected', 'rejected' ]`と`true`でした。タイマー2本へ同じsignalを渡し、どちらも同じ`Error`オブジェクトを理由にrejectしています。`Promise.allSettled`は結果を集める役割で、タイマーを止めているのは`delay`内のabort処理です。

実行例ではキャンセル前に集約Promiseを作っています。失敗の通知を受け取る経路を用意してからabortする構成です。

## 7条件で後始末まで確認した

検証日は2026年9月11日、環境はmacOS arm64、Node.js 24.15.0です。自作関数のabortリスナー数はNode.jsの`getEventListeners`で調べました。

| 条件 | 観測結果 |
| --- | --- |
| 呼び出し前にabort済み | 同じ理由でreject、残るabortリスナーは0 |
| 同じsignalで待つ2本をabort | 両方reject、登録リスナーは2から0 |
| 通常完了後にabort | fulfilledのまま、完了時点でリスナーは0 |
| signalなしの処理を混ぜる | 対応した処理だけreject、signalなしの処理は完了 |
| Node.jsのPromise版タイマーをabort | AbortErrorでreject、`cause`が指定した理由 |
| 手動signalとtimeoutを`AbortSignal.any`で合成 | 手動abortの理由で自作delayがreject |
| timeoutだけを発火させる | TimeoutErrorで自作delayがreject |

待機中のケースでは10000ミリ秒のタイマーを登録してから中断しました。通常完了のケースは0ミリ秒、timeout発火のケースは1ミリ秒です。これらは状態を切り替えるための設定値で、処理時間や中断の応答速度を測った数値ではありません。

自作delayはreject後にタイマーを消し、Node.jsプロセスも終了しました。リスナー数の検査と合わせて、Promiseだけrejectして長いタイマーを残す実装になっていないことを確認しています。

## 中断理由の返し方はAPIごとに違う

自作delayは`signal.reason`をそのままrejectへ渡しています。一方、Node.jsの`node:timers/promises`に同じ`Error`を理由として渡したケースでは、受け取ったのは別の`AbortError`で、`cause`が元の理由でした。

Node.jsの[Promise版タイマー](https://nodejs.org/download/release/v24.15.0/docs/api/timers.html#cancelling-timers)はAbortSignalによるキャンセルを用意しています。Node専用の待機なら、そのAPIを使う選択肢があります。今回、自作したのは中断時に処理側が何を片付けるかを観察するためです。

複数のsignalをまとめる`AbortSignal.any`は、最初に中断したsignalの理由を合成先へ渡します。`AbortSignal.timeout`も含め、利用する実行環境で対応を確認します。[Node.jsのAbortSignalリファレンス](https://nodejs.org/download/release/v24.15.0/docs/api/globals.html#class-abortsignal)で両APIを確認できます。

## signalを渡していない処理は止まらない

7条件のうち1つでは、キャンセル対応のdelayと、signalを渡していないPromise版タイマーを並べました。abort後、前者はrejectしましたが、後者の完了フラグは`true`になりました。controllerを共有する変数があるだけではキャンセル対象にはなりません。

また、この仕組みを同期的にCPUを占有するループの強制停止としては検証していません。ネットワーク要求の中断が相手サーバーの処理や保存済みデータを巻き戻す、という保証もこの記事の実験にはありません。ここで確認したのは、同じプロセス内の待機処理がsignalへ協調して反応する範囲です。

[自作関数](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/language-batch08/cancellable-delay.mjs)、[検証コード](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/language-batch08/run-runtime.mjs)、[7条件の結果](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/production/2026-09/batch-08/abort-results.json)を残しました。キャンセルを追加するときは、開始前の確認、中断時のリソース解放、通常完了時のリスナー解除までを1つの処理として確認できます。
