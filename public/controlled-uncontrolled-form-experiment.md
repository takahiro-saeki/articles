---
title: "controlled inputの再実行はstateの置き場所で変わる。10・100・500項目で比較する"
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

フォームの項目数だけで、controlledとuncontrolledのどちらが向いているかは決まりません。controlledでも、stateを各入力欄へ置くと、1欄の編集で呼ばれた入力コンポーネントは1つでした。

親が全入力を管理する版、各入力が自分のstateを持つ版、DOMが値を持つ版を、10・100・500項目で比べました。再実行を減らすには、controlledかどうかに加えて、stateをどこへ置くかを検討します。

## 同じ入力操作でコンポーネント呼び出しを数える

3つの入力コンポーネントは次のとおりです。`trace`は実験側のカウンターで、アプリ用の状態ではありません。

```jsx
function ControlledField({ index, value, onChange }) {
  trace.fieldRenders++;
  return <input name={`field-${index}`} value={value} onChange={onChange} />;
}
function LocalField({ index }) {
  trace.fieldRenders++;
  const [value, setValue] = useState(initialValue(index));
  return <input name={`field-${index}`} value={value} onChange={event => {
    trace.fieldChanges++;
    setValue(event.target.value);
  }} />;
}
function UncontrolledField({ index }) {
  trace.fieldRenders++;
  return <input name={`field-${index}`} defaultValue={initialValue(index)} />;
}
```

親管理版は`values`配列をstateに持ち、変更された位置だけを書き換えて全入力へ渡します。個別state版は`LocalField`の中で値を更新します。uncontrolled版は`defaultValue`で初期値を与え、送信時にFormDataから読みます。

各条件の項目数と並び順は固定です。入力を削除・挿入・並べ替えする処理は含めず、位置をkeyに使っています。

実験ではどの入力にも異なるnameを付け、最初の欄の値を`field-0`から`edited`へブラウザのfill操作で置き換えました。文字を1つずつ打った実験ではありません。controlledの両版では、この操作でonChangeが1回動いたことを確認しました。

測ったのは初回表示後、入力操作によって増えたコンポーネント関数の呼び出し回数です。

| stateの配置 | 項目数 | フォーム親の追加呼び出し | 入力コンポーネントの追加呼び出し |
| --- | --- | --- | --- |
| 親に集約 | 10 | 1 | 10 |
| 親に集約 | 100 | 1 | 100 |
| 親に集約 | 500 | 1 | 500 |
| 入力ごとのstate | 10 | 0 | 1 |
| 入力ごとのstate | 100 | 0 | 1 |
| 入力ごとのstate | 500 | 0 | 1 |
| DOMに保持 | 10 | 0 | 0 |
| DOMに保持 | 100 | 0 | 0 |
| DOMに保持 | 500 | 0 | 0 |

React Compiler、memo、Strict Modeを使わないproduction buildです。したがって、この表は最適化前の同じ構造を比べたものです。入力コンポーネントが0回でも、ブラウザ側で入力や描画の仕事がなくなるという意味ではありません。処理時間、FPS、メモリ使用量は測っていません。

[Reactのinputリファレンス](https://react.dev/reference/react-dom/components/input)は、controlled inputでonChangeに応じて値を更新することや、stateを必要な範囲へ移す方法を説明しています。今回の観測でも、controlledという選択だけで親全体の再実行が必須にはなりませんでした。

## 値を集める結果も確認する

9条件すべてで、編集後にFormDataを作ると、項目数と同じ個数の値が得られ、最初の値は`edited`でした。個別state版の全値を、親のReact stateへ同時に集約したわけではありません。今回の送信時の読み取り方法で、DOMに反映された値を集めた結果です。

全欄を使った即時プレビューや欄をまたぐ検証が必要なら、値をどこで読み取るかを追加で設計します。この実験は独立したtext inputだけで、フォームライブラリやIME、非同期バリデーションは含めていません。

## resetは同じボタンでも結果が違った

編集後に`type="reset"`のボタンを押すと、今回のcontrolledの両版は`edited`のままで、uncontrolled版は`field-0`へ戻りました。

| 方式 | HTMLのreset後 | 実験で明示的に戻した方法 |
| --- | --- | --- |
| 親のstate | edited | 初期値の配列をsetState |
| 入力ごとのstate | edited | formのkeyを変えて再mount |
| uncontrolled | field-0 | form.reset() |

個別state版のkey変更は、初期化できることを確かめるための操作です。再mountはその下のコンポーネント状態も作り直すため、フォーカスや他のstateを保ったままリセットしたい要件に、そのまま当てはめる方法ではありません。

3方式とも明示的なリセット後の最初の値は`field-0`でした。native resetとReact stateの初期化を同じものとして扱わず、採用した値の持ち方に合わせて戻し方を確認します。[formの公式説明](https://react.dev/reference/react-dom/components/form)も、イベントでの送信とFormDataによる読み取りを扱っています。

検証日は2026年9月11日、React / React DOM 19.3.0、Node.js 24.15.0、esbuild 0.28.2、macOS arm64、Headless Chrome 152です。[フォーム全体のコード](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/react-batch09/forms.jsx)と[9条件の結果](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/production/2026-09/batch-09/browser-results.json)を残しました。今回の比較からは「500項目なら必ずuncontrolled」とは決められません。入力中にReact側で必要な値と、送信・リセットの方法まで揃えて選べます。
