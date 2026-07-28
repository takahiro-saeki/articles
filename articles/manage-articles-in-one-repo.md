---
title: "Zenn・Qiita・dev.toの記事を1つのGitHubリポジトリで管理する"
emoji: "🗂️"
type: "tech"
topics: ["zenn", "qiita", "devto", "github"]
published: false
---

技術発信を再開するにあたって、ZennとQiitaとdev.toを使い分けることにしました。Qiitaは単発の実務Tips、Zennは長めの解説、dev.toは反応が良かった記事の英訳クロスポストという分担です。

プラットフォームが3つに分かれると原稿の置き場所が散らかって、たぶん続きません。なので原稿は1つのGitHubリポジトリに集約しました。ZennとQiitaは公式CLIがこの運用を想定して作られていて、dev.toだけ小さいスクリプトを1本書けば足ります。この記事はその構成メモです。

リポジトリはここで公開しています: https://github.com/takahiro-saeki/articles

## 全体像

```
articles/  (リポジトリ)
├── articles/     ← Zennの記事 (zenn-cli)
├── books/        ← Zennの本
├── public/       ← Qiitaの記事 (qiita-cli)
├── devto/        ← dev.to向け英訳記事
├── scripts/
│   └── publish-devto.mjs  ← dev.to投稿スクリプト(自作)
└── .github/workflows/publish.yml  ← Qiita自動公開
```

どのプラットフォームも「Markdownをディレクトリに置く」だけの同じ体験に揃えてあります。

## Zenn: zenn-cli + GitHub連携

```bash
npm i -D zenn-cli
npx zenn init
npx zenn new:article --slug my-article --title "タイトル" --type tech
npx zenn preview
```

ZennはGitHub連携(ダッシュボードの「GitHubからのデプロイ」)でリポジトリを繋ぐと、mainにpushするだけで `published: true` の記事が公開されます。3つの中で一番手離れが良くて、公開作業というものが存在しません。この記事もpushで公開しています。

## Qiita: qiita-cli

```bash
npm i -D @qiita/qiita-cli
npx qiita init
npx qiita login   # トークンを貼る(read_qiita / write_qiita)
npx qiita new my-article
npx qiita publish my-article
```

公開すると記事IDがfrontmatterに書き戻されて、以降は同じコマンドで更新になります。リポジトリが正、Qiitaがミラーという関係を保てるのが良いところです。

1つ知らなかった挙動として、`npx qiita pull` を打つと過去にWebで書いた記事も全部ローカルに同期されます。私の場合、2016年からの13記事がID名のMarkdownファイルとしてリポジトリに引っ越してきました。過去記事の修正もこれでgit管理に乗ります。

## dev.to: 公式APIに数十行のスクリプト

dev.toには公式のREST APIがあり、`POST /api/articles` にMarkdownを投げるだけで投稿できます。CLIはありませんが、必要な機能だけの投稿スクリプトは数十行で書けます。

```js
const article = {
  title: fm.title,
  body_markdown: body,
  published: fm.published === "true",
  tags: fm.tags.split(",").map(t => t.trim()).slice(0, 4),
  canonical_url: fm.canonical_url,
};

const res = await fetch("https://dev.to/api/articles", {
  method: "POST",
  headers: { "api-key": apiKey, "Content-Type": "application/json" },
  body: JSON.stringify({ article }),
});
```

工夫したのは2点です。

1つ目はcanonical_urlです。dev.toへの投稿は日本語記事の英訳クロスポストなので、frontmatterで元記事(Qiita/Zenn)のURLを必ず指定します。dev.toはcanonical指定を正式にサポートしているので、翻訳版が元記事と検索で競合しません。

2つ目はdevto_idの書き戻しです。初回投稿のレスポンスに含まれる記事IDをスクリプトがfrontmatterに書き込み、次回からは同じコマンドがPUT(更新)に化けます。qiita-cliと同じ挙動を自作側でも揃えた形です。

## ハマったところ

APIキーは `.env` に置いてgitignoreしているのですが、最初 `.gitignore` への追記が効きませんでした。原因は元の `.gitignore` の末尾に改行がなかったことで、`echo ".env" >>` した結果、最終行が `.DS_Store.env` という1つのパターンに合体していました。地味ですが、公開リポジトリで秘密情報を扱うときにやりがちな事故だと思うので書いておきます。追記の前に `tail -c 1` で末尾改行を確認するか、エディタで開いて足すのが確実です。

あとdev.toのタグは仕様上最大4つなので、スクリプト側で `slice(0, 4)` して超過分を切り捨てるようにしています。

## この構成の副効果

原稿をリポジトリ管理にすると、執筆がそのままGitHubのコミット履歴になります。記事を書くほど公開リポジトリに活動が積まれるので、GitHubのプロフィールがそのまま発信の記録になる。LAPRASのようなGitHub連携でスコアを出すサービスにも執筆活動が反映されます。書く動機が1つ増えるという意味で、地味に効いています。

## おわりに

この運用を始めてまだ数日ですが、「どこに書くか」を考える時間がゼロになったのは想像以上に快適です。記事を書く場所を散らかしたまま挫折した経験がある方は、リポジトリ集約から始めてみると続けやすいかもしれません。
