---
title: "Universal LinksのAASAは200だけでは足りない。開発版のappIDとパスを照合する"
tags:
  - iOS
  - UniversalLinks
  - Expo
  - デバッグ
private: false
updated_at: null
id: null
organization_url_name: null
slide: false
ignorePublish: true
---

AASAが200でJSONを返していても、そのアプリが対象とは限りません。HTTP応答、アプリ識別子、対象パス、端末が参照している関連付けを順に確認します。

実際に本番と開発のAASAを取得したところ、両方とも200でしたが、本文は同じ本番アプリ用の定義でした。開発版の設定と照合して初めて、対象のアプリ識別子が含まれていないと分かりました。

## 最初のGETではリダイレクトを追わない

調査日は2026年9月11日です。次のようにヘッダーと本文を分けて保存します。

```sh
curl --silent --show-error \
  --dump-header aasa.headers \
  --output aasa.json \
  https://squad-note.com/.well-known/apple-app-site-association
```

-Lを付けてリダイレクトを追うと、最初の応答が302だったことを見落としやすくなります。[AppleのTN3155](https://developer.apple.com/documentation/technotes/tn3155-debugging-universal-links)では、AASA自体をリダイレクトで配信する構成はサポートされません。利用者がタップするリンクの転送とは区別します。

今回取得した応答は次のとおりです。認証情報は送っていません。

| ドメイン | HTTP | Content-Type | 本文のappID |
| --- | ---: | --- | --- |
| squad-note.com | 200 | application/json | 3VDD942S97.com.squadnote.app |
| dev.squad-note.com | 200 | application/json | 3VDD942S97.com.squadnote.app |

本文は各125バイトで、ハッシュも一致しました。両方のCache-Controlはs-maxage=31536000でした。これは取得時点で観測した応答で、AppleのCDNや実機から同じ内容を取得した記録ではありません。

## 開発版の識別子が、JSONに含まれるか

circle-hubの固定commit `a34608c`で[アプリ設定](https://github.com/takahiro-saeki/circle-hub/blob/a34608c611ded6549c1176a7977e68e1bc62a8db/apps/mobile/app.config.ts)を読みました。環境を渡して設定関数を評価すると、本番と開発で次の値になります。

| 環境 | bundleIdentifier | associatedDomains |
| --- | --- | --- |
| production | com.squadnote.app | applinks:squad-note.com |
| development | com.squadnote.app.dev | applinks:dev.squad-note.com |

[固定コードのAASAルート](https://github.com/takahiro-saeki/circle-hub/blob/a34608c611ded6549c1176a7977e68e1bc62a8db/apps/web/src/app/.well-known/apple-app-site-association/route.ts)が返す識別子は、取得した本文と同じ本番用でした。

したがって、ソースで指定した識別子の組み合わせで照合すると、開発版の3VDD942S97.com.squadnote.app.devは見つかりません。開発ドメインで取得できたからといって、開発アプリとの関連付けを確認できたことにはなりません。

ここまでの照合は設定ファイルが対象です。インストール済みアプリの署名付きentitlementsは調べていないため、特定の端末でリンクが開かない原因を確定したとはしていません。実際のビルドでは、そのアプリのapplication-identifierとAssociated Domainsも確認します。

## 既存のpathsについて、対象URLを比較する

取得したAASAは、appIDとpathsを使うlegacy形式です。pathsには次の3件があります。

```json
[
  "/organizations/*",
  "/s/*",
  "/invite/*"
]
```

[Appleの旧形式の説明](https://developer.apple.com/library/archive/documentation/General/Conceptual/AppSearch/UniversalLinks.html)では、pathsの照合はパスを使い、queryとfragmentを使いません。大文字と小文字も区別します。この形式と、appIDs・componentsを使う形式を無造作に混ぜないようにします。

手元では、今回の正の前方一致パターンだけを扱う小さな比較関数で確認しました。URLはJavaScriptのURLで分解し、pathnameが指定の接頭辞で始まるかを見ます。

| URLのパスなど | 今回の限定チェッカー |
| --- | --- |
| /invite/demo | 一致 |
| /invite/demo?openExternalBrowser=1#check | 一致 |
| /Invite/demo | 一致しない |
| /invite | 一致しない |
| /settings | 一致しない |

この関数はAppleのマッチャーではありません。componentsや除外ルールは扱わず、対応していない形式は「未対応」として止めます。未対応を、不正なAASAと同じ意味にはしません。

HTTP 302、Content-TypeがHTML、不正JSON、開発版のappID不一致、components形式も加え、計10条件を確認しました。実データの比較と、条件を変えたローカル試験を合わせた数です。

## Appleの検証と、端末の関連付けは別に確認する

TN3155には、Macのswcutilで保存済みJSONとURLを検証する手順があります。今回のmacOS 26.6.2ではroot権限が必要で、非対話のsudoはパスワードが必要として終了しました。そのためswcutilによる照合は未実行です。ローカルの限定チェッカーを、その代わりの公式検証として扱ってはいません。

実機を調べる場合は、署名済みアプリの関連ドメイン、端末の診断、リンクを開く操作を合わせて確認します。Safariのアドレス欄への直接入力や、同じドメイン内の移動だけでは、外部からUniversal Linkを開く確認にならない場合があります。

今回、端末上でリンクをタップする試験やsysdiagnoseの取得は行っていません。JSONが正しく見えるところまでと、OSがアプリを選ぶところまでを別々の結果として残します。

## オリジンのヘッダーから、端末のキャッシュを推定しない

AppleはiOS 14以降、AASAの取得・キャッシュに自社CDNを使うと説明しています。オリジンの本文を更新しても、それだけでインストール済み端末が新しい関連付けを使ったとは分かりません。

今回見つかったs-maxage=31536000だけを根拠に、「端末はその秒数まで更新しない」とは判断できません。確認したのはオリジンの応答です。Apple側や端末側の状態は、別の観測が必要です。

この記事ではAASAもアプリ設定も変更していません。取得したJSON、設定上のappID、対象URLを照合し、開発版の識別子が応答に含まれないことを確認しました。署名済みビルドと端末側の検証が次に残ります。
