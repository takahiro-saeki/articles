---
title: "unknownを付けるだけではAPI応答を検証できない。anyと型アサーションを比較する"
tags:
  - TypeScript
  - API
  - テスト
private: false
updated_at: null
id: null
organization_url_name: null
slide: false
ignorePublish: true
---

外部APIの応答をunknownで受けると、検査せずにプロパティを読むコードをコンパイラが止めます。ただし、unknownという型がJSONの形を実行時に検証するわけではありません。

個人開発のPush送信処理を題材に、any、unknown、型アサーションを比較しました。コンパイル結果に加えて実行時のログも比較すると、不正な応答を読み飛ばすケースがありました。

## 同じJSONで、型だけを変える

次の値はdataが配列ではありません。

```ts
const raw = '{"data":{"unexpected":true}}';
const value: any = JSON.parse(raw);
console.log(value.data[0].status.toUpperCase());
```

macOS 26.6.2、Node.js 24.15.0、TypeScript 7.0.2で検証しました。コンパイル条件はstrict、target ES2022、noEmitです。実行時の比較では型だけを取り除いています。

| 受け方 | コンパイル | 実行時 |
| --- | --- | --- |
| valueをanyとする | 通る | TypeError |
| valueをunknownとし、同じ読み方をする | TS18046で止まる | コンパイルが通るコードとして実行しない |
| dataが配列の型へasで指定する | 通る | TypeError |

[TypeScriptのunknownの説明](https://www.typescriptlang.org/docs/handbook/2/functions.html#unknown)のとおり、unknownのままでは具体的なプロパティ操作ができません。[型アサーションの説明](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#type-assertions)では、asは実行時に検査を追加せず、コンパイル時に取り除かれます。

unknownで止まった行をasで通しても、応答を検証したことにはなりません。上の比較では、不正なJSONの形は変わらないままでした。

## 実コードでは、不正な応答が例外にならない場合もあった

circle-hubの固定commit `a34608c`にある[Push送信処理](https://github.com/takahiro-saeki/circle-hub/blob/a34608c611ded6549c1176a7977e68e1bc62a8db/apps/web/src/server/api/lib/expo-push.ts)では、`await res.json()`をExpoSendResponseへasで指定しています。HTTPエラーやチケットのエラーは確認していますが、このas自体は構造を調べません。

取得した関数をそのまま使い、fetch、DB、ログの出力先をローカルの代替処理へ差し替えました。応答だけを変えた6ケースの結果です。実APIへの送信はありません。

| 応答 | ログ呼び出し数 | 無効トークン削除数 | 関数のPromise |
| --- | ---: | ---: | --- |
| 正常なokチケット | 0 | 0 | fulfilled |
| DeviceNotRegisteredのerrorチケット | 1 | 1 | fulfilled |
| dataがオブジェクト | 0 | 0 | fulfilled |
| statusが数値 | 0 | 0 | fulfilled |
| 応答全体がnull | 1 | 0 | fulfilled |
| HTTP 503 | 1 | 0 | fulfilled |

dataがオブジェクトの場合、コードが参照するlengthはundefinedになり、チケットを処理するループへ入りません。statusが数値の場合も、errorとの比較に一致せず読み飛ばします。一方、nullではプロパティ参照が例外となり、catch側がログを残します。

この結果から、Promiseがfulfilledだったことだけで、応答の形が正しかったとは判断できません。ここでの削除も代替DB上の記録で、実トークンを削除したものではありません。

## 読みたい部分を、unknownから検査する

同じリポジトリの[未ログイン回答の保存処理](https://github.com/takahiro-saeki/circle-hub/blob/a34608c611ded6549c1176a7977e68e1bc62a8db/apps/mobile/src/lib/guest-response-store.ts)では、JSON.parseの結果をunknownにし、配列や行の項目を検査しています。これは保存データの処理ですが、境界で値を受けてから必要な形を調べる手順はAPI応答にも使えます。

次は、その考え方で今回新しく作った、チケットのstatusだけを読む関数です。元のPush送信処理へ適用した修正ではありません。

```ts
function readTicketStatuses(value: unknown): Array<"ok" | "error"> {
  if (
    typeof value !== "object" || value === null ||
    !("data" in value) || !Array.isArray(value.data)
  ) {
    throw new Error("Expected a data array");
  }
  return value.data.map((ticket: unknown) => {
    if (
      typeof ticket !== "object" || ticket === null ||
      !("status" in ticket)
    ) {
      throw new Error("Expected a ticket object");
    }
    const status = ticket.status;
    if (status !== "ok" && status !== "error") {
      throw new Error("Unexpected ticket status");
    }
    return status;
  });
}
```

unknownは検査を促し、if文が実際の検査を行います。返すのも、確認したstatusの配列だけです。元のオブジェクト全体へ「検証済み」という型を付け直してはいません。

6ケースを渡すと、正常なチケット配列と空配列は受け入れました。dataがオブジェクト、statusが数値、チケットがnull、応答全体がnullの4ケースは例外で拒否しました。

## この関数で検査していないもの

この例はExpo応答全体のバリデーターではありません。チケットID、details、message、リクエスト全体のerrors、送信件数との対応は調べていません。それらを使う処理へ組み込むなら、必要な項目とエラー応答の分岐を追加します。

また、空配列を受け入れているので、「送信した件数と同じ数の結果が返る」という条件も別に必要です。型を狭めた後も、処理に必要な件数や対応関係は確認します。

実データの検査で失敗した場合に、送信を再試行するか、処理を中断して観測できる結果を返すかも呼び出し側で決めます。今回の検証では不正な応答の扱いを確認しただけで、元の送信処理の戻り値や再試行方針は変更していません。
