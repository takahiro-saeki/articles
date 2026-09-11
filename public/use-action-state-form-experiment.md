---
title: "useActionStateは入力値も残してくれるか。通常のフォームstateと9条件で比較する"
tags:
  - React
  - JavaScript
  - フォーム
private: false
updated_at: null
id: null
organization_url_name: null
slide: false
ignorePublish: true
---

`useActionState`は、Actionの結果とpendingを管理します。入力欄の値まで自動的に保存するHookではありません。今回のフォームでは、検証エラーを戻り値で返しただけでもuncontrolled inputが空になりました。

普通のonSubmitとuseStateで処理する版と比較し、入力を残す修正も試しました。Actionの結果を持つstateと、失敗時に残したい入力は、それぞれ設計が必要です。

## 同じ処理をActionとonSubmitから呼ぶ

検証用の保存処理は次のコードです。ネットワークへは送信せず、Promiseのresolveをブラウザ操作から進めます。`trace`は呼び出し順と保留中の処理を記録する実験用オブジェクトです。

```jsx
async function save(previous, formData) {
  const name = formData.get('name');
  trace.calls.push({ previous: { ...previous }, name });
  await new Promise(resolve => trace.gates.push(resolve));
  if (name === 'crash') throw new Error('simulated failure');
  if (name === 'bad') return { ...previous, message: 'invalid' };
  return { count: previous.count + 1, message: `saved:${name}` };
}
```

`good`は成功結果、`bad`は検証エラーを表す戻り値、`crash`はthrowです。`previous`を第1引数、FormDataを第2引数として受け取ります。

Action版では`useActionState(save, initialState)`の戻り値をstate、formAction、pendingとして受け取り、`formAction`をformのactionへ渡しました。inputは`defaultValue=""`のuncontrolledです。[useActionStateの公式説明](https://react.dev/reference/react/useActionState)には、前回の結果を次の呼び出しへ渡す引数と、保留中を表す戻り値が定義されています。

手動版は、同じsaveをonSubmitから呼びます。

```jsx
async function onSubmit(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setPending(true);
    try { setState(await save(state, data)); }
    catch (error) { setState(previous => ({ ...previous, message: error.message })); }
    finally { setPending(false); }
  }
```

手動版も入力はuncontrolledで、成功時にform.resetを呼ぶ処理は入れていません。pendingと結果をsetStateし、例外はcatchでメッセージへ変えます。これをuseState全般の限界と扱う比較ではなく、どの処理を自分で書いているかを見るための最小実装です。

## 戻り値のエラーとthrowは違った

最初に6条件を比較しました。すべての送信で、処理を保留している間はpendingがtrueになり、入力した文字列も残っていました。

| 方式と入力 | 完了時の結果 | 完了後のinput |
| --- | --- | --- |
| Action、good | count 1、saved:good | 空 |
| 手動、good | count 1、saved:good | good |
| Action、bad | count 0、invalid | 空 |
| 手動、bad | count 0、invalid | bad |
| Action、crash | Error Boundaryへ移る | formが外れる |
| 手動、crash | count 0、catchしたメッセージ | crash |

`bad`のActionは`invalid`を返しても、Promiseとしては正常に解決しています。[Reactのformリファレンス](https://react.dev/reference/react-dom/components/form)にある、Action成功後のuncontrolled inputのresetが、この例でも行われました。アプリが戻り値を検証エラーとして扱うことと、Actionがthrowすることは別です。

throwしたActionにはError Boundaryを用意し、フォームの代わりに`simulated failure`を表示することを確認しました。手動版はcatchしてstateへ入れる実装なので、同じ表示遷移にはなりません。

## 残したい入力を結果へ含める

検証エラーで入力を失わないよう、次の版を追加しました。

```jsx
async function saveWithInput(previous, formData) {
  const next = await save(previous, formData);
  return { ...next, input: next.message === 'invalid' ? String(formData.get('name')) : '' };
}
export function PreservingExperiment() {
  const [state, formAction, pending] = useActionState(saveWithInput, { ...initialState, input: '' });
  return <section>
    <output id="action-state">{JSON.stringify(state)}</output>
    <output id="action-pending">{String(pending)}</output>
    <form id="action-form" action={formAction}>
      <input id="action-input" name="name" defaultValue={state.input} />
      <button id="action-submit" disabled={pending}>Save</button>
    </form>
  </section>;
}
```

検証エラーなら入力値を返し、inputの`defaultValue`へ渡します。成功時は空文字列を返します。追加の2条件では、`bad`の後は`bad`が残り、`good`の後は空になりました。

この修正でもinputを`value`で制御してはいません。Action後に使う初期値をstateへ含めることで、今回のreset後に必要な値を残しています。既存アプリへ組み込み済みのフォームではなく、この実験内で動作を確かめた修正です。

## 複数回呼ぶと前回結果を待つ

もう1つ、フォーム送信とは別のボタンから2回dispatchする条件を確認しました。

```jsx
function queueTwo() {
    startTransition(() => {
      for (const name of ['first', 'second']) {
        const data = new FormData(); data.set('name', name); formAction(data);
      }
    });
  }
```

最初のPromiseを解決するまでは、saveの呼び出し記録は1件でした。解決すると2件目が始まり、その`previous.count`は`1`でした。最終的なstateはcount `2`、message `saved:second`です。

| 観測時点 | 開始済みのsave | 画面のcount | pending |
| --- | --- | --- | --- |
| 1件目を保留中 | 1 | 0 | true |
| 1件目解決後、2件目を保留中 | 2 | 0 | true |
| 両方解決後 | 2 | 2 | false |

この実験では、次のActionに渡る前回結果と、画面へ反映された中間stateを同じものとして読めませんでした。呼び出し履歴とDOMを両方記録しています。

formのactionから呼ぶ場合はReactがTransitionとして扱います。今回のようにボタンから直接dispatchする比較では`startTransition`内で呼びました。Transition外での呼び出しや、並列処理をこのHookへ任せる設計は検証していません。

## 今回はクライアント関数だけを検証した

検証日は2026年9月11日、React / React DOM 19.3.0、Node.js 24.15.0、esbuild 0.28.2、macOS arm64、Headless Chrome 152です。production build、Strict ModeとReact Compilerなしで、計9条件を確認しました。待機は手動で解決し、通信時間は測っていません。

Server FunctionやJavaScript読み込み前の送信、permalink、認証・保存処理は含めていません。公式APIはServer Functionとの組み合わせも扱っていますが、この記事の結果はブラウザ内の関数を使ったものです。サーバー側の検証や認可は、この実験では実装・検証していません。

[比較コード](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/react-batch09/actions.jsx)と[9条件の結果](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/production/2026-09/batch-09/browser-results.json)を残しました。pendingや戻り値に加えて、入力を消すか残すか、例外時にどこへ表示を移すかまで確認できます。
