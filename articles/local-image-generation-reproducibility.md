---
title: "ローカル画像生成を再現可能にするため、モデル本体以外に何を保存するか"
emoji: "🧪"
type: "tech"
topics: ["画像生成", "comfyui", "python", "個人開発"]
published: false
---

ローカルにモデルを置けば、画像生成の条件も手元で管理できます。ただ、後から残った画像とモデル名だけを見ても、どのworkflowを、どの設定と実行環境で動かしたのかは分かりません。

まず残したいのは、送信したworkflowの本体、モデルを特定する情報、実行環境、そして処理がどの段階まで進んだかです。`local-anime-studio`の実装を読み、実行記録に何が入り、どの失敗では記録が残らないかを確認しました。

確認日は2026年9月11日、対象コミットは`2aeb306`です。検証はPython `3.14.5`で行い、ComfyUIへの通信をモックに置き換えています。GPU生成、モデルの再ダウンロード、画像のピクセル一致の比較は実施していません。

## モデル名に加えて、どのファイルかを記録する

対象リポジトリは、ComfyUI本体やモデルの重みを内包せず、設定と実行を扱います。[モデルの設定ファイル](https://github.com/takahiro-saeki/local-anime-studio/blob/2aeb306e4baa272afab9a133357eb1e6e141e964/configs/models.animagine-xl-4.0-opt.yaml)には、提供元、モデルのリポジトリ、固定revision、ファイル名、サイズ、SHA-256、ライセンス情報が記録されています。

この情報は「Animagineを使った」より具体的です。同じ表示名のモデルでも、後で取得したファイルが同じものかを確かめるには、取得元とファイルの識別情報が要ります。

ただし、設定にSHA-256が書かれていることと、今回の実行環境にある重みをその値で検証したことは別です。今回確認したのは台帳の値と構造であり、モデル本体のハッシュ検証は行っていません。

リポジトリの履歴には、画像生成の基礎を加えた`d78eb55`と、ローカルUIなどを加えた`2aeb306`があります。以下は後者の時点の実装で、今後の改善案は分けて記します。

## workflowの名前より、本体を保存する

[画像生成用workflow](https://github.com/takahiro-saeki/local-anime-studio/blob/2aeb306e4baa272afab9a133357eb1e6e141e964/workflows/image/animagine-xl-4.0-opt-1024.json)には、チェックポイント、正負のプロンプト、画像寸法、サンプリング条件、保存ノードが入っています。

ファイル名には`1024`が含まれていますが、実際の寸法は832 × 1216です。seedは42、stepsは28、CFGは5.0、samplerは`euler_ancestral`、schedulerは`normal`です。ファイル名から正方形の画像を生成すると思い込むと、記録を読み違えます。

[CLIの実装](https://github.com/takahiro-saeki/local-anime-studio/blob/2aeb306e4baa272afab9a133357eb1e6e141e964/src/local_anime_studio/__main__.py)は、`--record`を指定するとworkflowのJSON本体と、読み込んだバイト列のSHA-256を記録します。ファイルを後で編集しても、実行時に何を渡したかを記録から読める形です。

関連部分を簡略化すると、次の順序です。これは保存順を説明する抜粋で、単独実行用のコードではありません。

```python
workflow_bytes = workflow_path.read_bytes()
workflow = json.loads(workflow_bytes)
system_stats = client.get_system_stats()
queued = client.queue_prompt(workflow)
completed = None
if wait:
    completed = client.wait_for_completion(queued["prompt_id"], timeout)

write_record(record_path, {
    "workflow": workflow,
    "workflow_sha256": hashlib.sha256(workflow_bytes).hexdigest(),
    "system_stats": system_stats,
    "queue_response": queued,
    "history_record": completed,
})
```

生のバイト列のハッシュなので、意味が同じJSONでも空白や改行を変えると値は変わります。ここでのハッシュは、内容が意味的に同等かを判定するものではなく、読み込んだファイルを区別するものです。

## キュー受付と生成完了は、別の記録になる

[ComfyUIのサーバーAPI](https://docs.comfy.org/development/comfyui-server/comms_routes)では、`POST /prompt`がworkflowを検査してキューへ追加し、`prompt_id`などを返します。環境情報は`/system_stats`、処理履歴は`/history/{prompt_id}`から取得できます。受付の応答だけでは生成完了を示しません。

そこで実CLIを一時ディレクトリへ固定コミットから展開し、クライアントだけを偽物に置き換えて、二つの経路を確認しました。[検証コード](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/local-image-records.py)はPython標準ライブラリを使います。

| 条件 | CLIの終了値 | 記録ファイル | 確認した内容 |
| --- | --- | --- | --- |
| `--record`、待機なし | 0 | 作成される | workflowとハッシュが一致、受付IDあり、`history_record`は`null` |
| `--record --wait`、受付後に待機がタイムアウト | 1 | 作成されない | 受付処理は呼ばれたが、保存まで到達しない |

二つ目の偽物は、受付時に`prompt_id`を返した後、完了待機で`TimeoutError`を送出します。単に通信前に失敗させたテストではありません。両ケースで受付メソッドが呼ばれたこともassertしています。

この差は、保存処理が完了待機の後にあるためです。「記録を指定したから、失敗した試行も必ず残る」とは言えないことが分かりました。

対象リポジトリの既存単体テスト34件も成功し、リポジトリ検証スクリプトも通りました。ただし、これらと上のモック検証は、実際のMPSデバイスで画像を生成できたという結果ではありません。

## 失敗した試行を残すなら、保存時点を変える

現在のCLIの記録には、日時、サーバー、workflowのパスと本体、環境情報、受付応答、取得できた履歴が含まれます。通常の実行条件を追う情報はありますが、待機中のタイムアウトには記録の空白ができます。

改善するなら、次のような段階を保存する設計が考えられます。

```text
送信前: workflow、モデル識別情報、環境を保存
受付後: prompt_idと受付状態を保存
完了後: 履歴と出力の参照を保存
失敗時: 最後に確認できた段階とエラーを保存
```

これは未実装の提案です。今回、CLIの保存順を変更したわけではありません。

失敗時の状態は、サーバー側の実行失敗と、クライアントが待ち切れなかった状態を分けます。タイムアウト後も処理が進んでいる可能性があるため、受付IDを残しておけば後から履歴を調べる入口になります。今回のモックではサーバー側の継続処理そのものは再現していません。

また、現在の記録にモデルの設定ファイル全体が自動で添付されるわけではありません。workflow内のチェックポイント名と、固定revisionやモデルハッシュの台帳を、実行時点の情報として結び付ける部分も改善対象です。

## 条件を追えることと、同じピクセルになることは違う

[PyTorchの再現性に関する説明](https://docs.pytorch.org/docs/main/notes/randomness.html)では、リリース、コミット、プラットフォームが変わった場合やCPUとGPUの間で、同じseedでも完全な再現が保証されないとされています。

そのため、記録の最初の目的は「同じ画像になる」と宣言することより、差が出たときに条件を比較できるようにすることです。workflowが違うのか、重みが違うのか、実行環境が違うのか、そもそも処理が完了していないのかを分けます。

今回確認できたのは、実行時のworkflow本体とハッシュを残す実装、待機しない経路の記録、待機タイムアウトで記録が残らない経路です。画像の再現実験を始める前に、失敗した試行も含めて条件と終了状態が残るかを確かめます。
