---
title: "日英記事のcanonical URLは、原稿作成時と投稿応答後で確定方法が違う"
tags:
  - Qiita
  - devto
  - JavaScript
private: false
updated_at: null
id: null
organization_url_name: null
slide: false
ignorePublish: true
---

Qiita向け日本語記事をまだ作成していない段階では、英語版のcanonical URLに必要な記事IDがありません。このリポジトリでは、Zennはslugから予定URLを組み立て、Qiitaは投稿APIの応答URLを使っています。原稿を揃えることと、URLを確定することは別の工程です。

既存スクリプトをメモリ上のファイルとAPIモックで動かし、URLがどこから入り、どこへ保存されるかを確認しました。外部への下書き作成や公開はしていません。

## 予定URLと応答URLを混ぜない

対象は`articles`のcommit `6fe4649`にある[予約投稿スクリプト](https://github.com/takahiro-saeki/articles/blob/6fe464919b7fba46d27395668d39d1e44b7f6964/scripts/publish-scheduled.mjs)です。2026年9月11日に読み、Node.js 24.15.0で検証しました。

| 日本語の媒体 | canonicalの取得元 | 確定の条件 |
| --- | --- | --- |
| Zenn | 投稿アカウントとファイルのslug | アカウントとslugを固定する |
| Qiita | 作成・更新APIが返した`result.url` | 対応するAPIの成功応答を受け取る |

[Qiita API v2](https://qiita.com/api/v2/docs)の作成要求には本文やタイトルなどを渡し、応答には記事の`id`と`url`が含まれます。この実装はファイル名をQiitaの記事IDへ変換していません。

Zennの予定URLも、ページが公開済みであることの証拠ではありません。ここでは未公開原稿の参照先として扱っています。

## 予約スクリプトは日本語の結果を英語へ渡す

Qiitaの分岐では、投稿が成功すると日本語ファイルへIDなどを書き戻し、その応答URLをdev.to側へ渡します。dev.toへ送るpayloadと英語frontmatterの両方に、同じURLを使います。

```text
Qiita response.url
  -> dev.to payload.article.canonical_url
  -> English frontmatter canonical_url
```

[Foremの公式仕様](https://developers.forem.com/api/v1)では、別の場所で発表した記事の元URLを`canonical_url`へ指定します。API上でnullが許されることと、日英の対応先が確定したことは別です。

モックで確認した結果は次のとおりです。

| 条件 | 結果 |
| --- | --- |
| 英語のcanonicalがnull | Qiitaの応答URLで置換された |
| 英語に古いZenn URLが残る | 同じくQiitaの応答URLで置換された |
| Qiitaが422を返す | dev.toへ進まず、ファイルへの書き込みもなかった |
| 日本語がZenn | 日本語ファイルのslugからURLを組み立てた |
| dry-run | API呼び出しも書き込みもなかった |

ここでの成功応答は合成データです。実際のQiitaページの存在や、dev.to側のcanonical表示を確認した結果ではありません。

## 単体のdev.toスクリプトでは、nullが文字列になる

もう一つの入口である[単体投稿スクリプト](https://github.com/takahiro-saeki/articles/blob/6fe464919b7fba46d27395668d39d1e44b7f6964/scripts/publish-devto.mjs)は、frontmatterを行ごとの正規表現で読んでいます。YAMLパーサーではありません。

英語原稿に次のように書くとします。

```yaml
published: false
canonical_url: null
```

このパーサーが取り出すのはJavaScriptの`null`ではなく、文字列の`"null"`です。空ではないので、canonicalを含める条件を通過します。実コードをモックで実行すると、送信payloadの値も文字列の`"null"`でした。

`published: false`はこの入口ではdev.toの外部下書きを作る指定であり、通信を止める指定ではありません。一方、予約スクリプトの通常経路は公開処理なので、既存の下書きフラグだけでは呼び出しを防げません。

調査では実認証情報を使わず、予約表も変更していません。単体入口のnull処理と、未確定URLを送信前に止める検査は改善候補として残ります。

## 未確定なら、その状態のまま制作台帳へ残す

公開予定のQiita IDを得るためだけに外部記事を作る運用にはしていません。IDがない段階の英語原稿は`canonical_url: null`をローカルの未確定表示とし、本文の検証が終わっても完成数へ入れない、という制作上の扱いです。

これはAPI送信に使える値という意味ではありません。公開が許可される別工程では、対応する日本語記事のURLを確定し、英語payload、保存したfrontmatter、投稿後の応答を照合する必要があります。

[6ケースの再現コード](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/canonical-lifecycle-batch12.mjs)は、固定commitの元コードを読み、I/Oだけを差し替えます。URLの伝達経路を検証したもので、検索順位への効果やサービス側の受け入れ結果は測っていません。未確定のURLを、見た目だけそれらしいURLで埋めないことが、この制作工程の条件です。
