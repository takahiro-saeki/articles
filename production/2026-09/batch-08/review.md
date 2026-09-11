# 第8バッチ: TypeScriptとJavaScriptの挙動を実行して確かめる

2026-09-11。T02、T04、T05、T06、T07、T08の日本語Qiita下書きと内容を保ったdev.to英訳を整備した。6組とも本文・コード・対訳・Humanizerの検証を完了したが、Qiitaの将来の記事IDが未確定なので状態は「執筆中」。canonical URLはnull、完成数には加えない。外部の下書き作成、公開、予約は行っていない。

このバッチ後は完成41/90、本文検証済み50/90、canonical待ち9、本文の検証が残る候補40。公開URLの未確定を本文の未着手と混同しないよう、進捗表に両方の本数を記録した。

## 読者が持ち帰る答えと根拠

| ID | 答え | 実験・確認 | 留保 |
| --- | --- | --- | --- |
| T02 | 設定値を検査して各プロパティの型を使うならsatisfies。型注釈・asと検出範囲は同一でない | 8 compilerケース。宣言出力、メンバー操作、必須キー欠落、literalの文脈、余分なキーを比較 | 外部データのruntime検査にはならない。診断番号は固定したcompilerの値 |
| T04 | 宣言統合を拡張契約にするかを先に決める。競合はextendsとintersectionで診断箇所が違う | 7 compilerケース。interface統合、alias重複、競合、never、構造的代入 | 単一モジュール実験。実ライブラリのaugmentationや型検査速度は未検証 |
| T05 | 型だけ必要か、実行時の名前付き値・逆引きも必要かを分ける | 7 compilerケース。enum出力、const enumのisolatedModules差、erasableSyntaxOnly、Node直接実行 | 同じファイル内の利用。ambient const enum、配布先version差、bundleサイズや速度は未測定 |
| T06 | importの型指定、依存先評価、型検査成功を分けて確認する | 8 import条件と型エラー対照1件。tscとesbuildの生成物・実行ログを比較 | ローカル2ファイル、sideEffects宣言なし。実アプリのbundleを測っていない |
| T07 | コピー対象の型と、維持する参照関係を決める | 12入力とtransfer。値・型・所有キー・参照・記述子・例外をassert | 合成データ。JSONの独自replacer/reviver/toJSONなし。ブラウザオブジェクト、性能、メモリ量は未測定 |
| T08 | 中断に反応する処理側で待機解除と通常完了時の後始末まで実装する | 7条件。reason同一性、リスナー数、signalなし処理の完了、Nodeタイマーcauseをassert | 同一プロセスの協調的待機。CPUループの強制停止、サーバーのrollbackは未検証 |

## 現在の一次資料

2026-09-11に本文を確認した。文言を引用して記事を埋めず、説明は自作入力の出力を中心にした。

- T02: [TypeScript 4.9 satisfies](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html)、[Type assertions](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#type-assertions)。仕様導入時の説明は現行サイトで確認し、挙動そのものは7.0.2で再検証。
- T04: [Declaration merging](https://www.typescriptlang.org/docs/handbook/declaration-merging.html)、[Type aliasesとinterfaces](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#differences-between-type-aliases-and-interfaces)。宣言統合を禁止するaliasと、余分なプロパティを持つ値の代入可否を区別。
- T05: [Enums](https://www.typescriptlang.org/docs/handbook/enums.html#reverse-mappings)、[erasableSyntaxOnly](https://www.typescriptlang.org/tsconfig/erasableSyntaxOnly.html)、[Node.js 24.15.0 TypeScript](https://nodejs.org/download/release/v24.15.0/docs/api/typescript.html)。enumの一律禁止を結論にしない。
- T06: [verbatimModuleSyntax](https://www.typescriptlang.org/tsconfig/verbatimModuleSyntax.html)、[esbuild TypeScript caveats](https://esbuild.github.io/content-types/#typescript-caveats)。過去の非推奨オプションやcompiler既定値を現在の実験条件に混ぜず、true/falseを明示。
- T07: [HTML structured serialization](https://html.spec.whatwg.org/multipage/structured-data.html#structuredserializeinternal)、[ECMAScript JSON.stringify](https://tc39.es/ecma262/multipage/structured-data.html#sec-json.stringify)、[Node.js structuredClone](https://nodejs.org/download/release/v24.15.0/docs/api/globals.html#structuredclonevalue-options)。循環・同じ子参照・転送の役割を照合。
- T08: [DOM abortable API](https://dom.spec.whatwg.org/#using-abortcontroller-and-abortsignal-objects-in-apis)、[Node.js timers](https://nodejs.org/download/release/v24.15.0/docs/api/timers.html#cancelling-timers)、[Node.js AbortSignal](https://nodejs.org/download/release/v24.15.0/docs/api/globals.html#class-abortsignal)。NodeのAbortErrorラップと、自作関数がreasonをそのまま返す契約を分けた。

個人リポジトリ`circle-hub`はcommit `770de5f2989775cfd95f7a9c4529565a2b48d2fd`の`packages/api/src/index.ts`をGitオブジェクトから参照した。実装は`export type`によるAPI型の再公開。ファイルのSHAは[repository-source.json](repository-source.json)。作業ツリーは他作業の変更があるため編集していない。今回は本番サーバーを読み込まず、型とログだけのregistryを合成して比較した。

## 実験を再実行する

リポジトリrootから依存を実験専用ディレクトリへ入れる。

```sh
npm ci --prefix experiments/article-stock-2026-09/language-batch08 --no-audit --no-fund
node experiments/article-stock-2026-09/language-batch08/run-compiler.mjs
node experiments/article-stock-2026-09/language-batch08/run-runtime.mjs
python3 experiments/article-stock-2026-09/verify-batch08-article-evidence.py
```

初回は固定versionをpackage.jsonへ書いてnpm installを行い、package-lock.jsonを保存した。TypeScript 7.0.2、esbuild 0.28.2、Node.js 24.15.0、macOS arm64。ルートの依存ファイルは変更しない。compilerケースは一時ディレクトリで実行し、生成物を結果JSONへ収めてから一時ディレクトリを削除する。例に通信や実ユーザーデータはない。

- [compiler-cases.json](../../../experiments/article-stock-2026-09/language-batch08/compiler-cases.json): 31ケースの実入力、期待診断、設定。
- [compiler-results.json](compiler-results.json): 実際のexit、診断、JavaScript、declaration、runtime出力。うち9ケースはesbuildの結果も収録。
- [clone-results.json](clone-results.json): 12入力、getter呼出合計、transfer、記事の表示例の実行ログ。
- [abort-results.json](abort-results.json): 7条件。タイマー設定値は実測速度として扱わない。
- [snippet-verification.json](snippet-verification.json): 記事の24コードブロックを実行済み入力・生成物と照合。transferの表示用コードは記事から取り出して実行。日英同一コードは別のvalidatorでも照合。

## 実験中に修正した想定

- 必須キー欠落をsatisfiesで検出した診断番号は、想定したTS1360ではなく、このcompilerではTS2741だった。診断本文が必須キー欠落を示すことを確認して期待値を修正した。型注釈側の欠落も別ケースを追加して確認した。
- verbatim=trueで型専用の通常importを使った場合、esbuildがmissing exportエラーになるという初期想定は成立しなかった。実際はbundle成功、registryの副作用も実行された。tscはTS1484で止まる。この差をそのまま記事の表へ記載した。
- T04初稿の「型宣言が消えてログ出力だけ残る」という説明は広すぎた。オブジェクトを作る実行時コードも残るため、日英ともその点を修正してからHumanizer監査を開始した。

これらは失敗を成功へ読み替えたものではなく、出力で誤った想定を修正したもの。最終ケースには実際に成功する入力と意図的に型検査へ失敗する入力を分けて記録している。

## 重複と対訳の確認

既存の`public/wrangler-types-dom-conflict.md`と`articles/trpc-share-types-next-expo.md`を読んだ。T06はグローバル型衝突の回避手順やtRPC構成の再紹介ではなく、importの書式とverbatim設定を変えた生成物・副作用比較を中心にした。T08は既存T01のPromise集約結果表を再利用せず、処理側のキャンセル契約とcleanupを答えにした。

今回のTypeScript記事同士でも、T02は値の推論と検査、T04は宣言の合成、T05は実行時の値、T06はモジュールの実行に分けた。同じversionや再現ファイルへのリンクを使うため英語の4-gram類似度が上がるが、説明する入力と結論は異なる。タイトルの完全一致はなく、[content-validation.json](content-validation.json)の近接候補を確認した。自動類似度は内容重複の証明・否定の代わりにはしない。

英訳は日本語各節の問題、比較入力、表、結果、例外、未検証範囲を保持。要約にせず、コードブロックと外部リンクは一致させた。経験したことがない過去の運用を一人称で補っていない。英語初稿の“I compared”も中立的な実験記述へ直した。

## Humanizerと最終ゲート

`/Users/takahiro_saeki/.agents/skills/humanizer/SKILL.md` v2.9.1を読み、ファイルモードのdraft→audit→finalを日英12ファイルへ適用した。「この記事の答え」「ポイント」「手順になります」の告知的な文、不要な一人称、曲線引用符などを修正した。

- [humanizer-edits.json](humanizer-edits.json): 手動で選んだ12件の推敲と、各記事の意味を保持した確認。
- [humanizer-audit.json](humanizer-audit.json): frontmatter、コード、URL、順序付き数値トークンが不変。推敲後の最終SHAを照合済み。
- [content-validation.json](content-validation.json): 日英6組の必須項目、非公開フラグ、タグ最大4、fence、日英コードとsource URL、タイトル、類似候補、予約表未追加を確認。canonicalの未確定は明示的に除外した本文用検証。
- [canonical-gate.json](canonical-gate.json): URL例外を許可しない完成判定では期待どおり失敗することを確認。
- [complete-validation.json](complete-validation.json): 既存の完成41組はcanonical例外なしで通過。
- [zenn-list.txt](zenn-list.txt): `npx zenn list:articles` exit 0。今回はQiita新規原稿なのでZennの列挙対象を増やす検査ではない。
- [repository-guard.json](repository-guard.json): 制作開始前の137ファイルと、このバッチ直前の211記事ファイルはbyte単位で不変。開始前ファイルの例外はアイデア表の進捗ブロックだけ。
- `git diff --check`とステージ後の`git diff --cached --check`は通過した。公開済み原稿、予約表、公開workflowは変更しない。

Qiitaのcanonical URLを架空のIDで埋めず、未公開ID作成のための外部書き込みもしない。ユーザーの方針回答または正規URLが得られるまで、この6組は本文検証済みの「執筆中」として保持する。
