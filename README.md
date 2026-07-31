# articles

技術記事の執筆・公開を一元管理するリポジトリ。Qiita / Zenn / dev.to の3プラットフォームをMarkdown + CLI/APIで運用する。

## 戦略

- **Qiita =「点」**: 実務Tips・単発解説・AI系Tips(週1目安)
- **Zenn =「線」**: 体系的な長編・ワークフロー解説(月1〜2本)
- **dev.to**: 反応が良かった記事を英訳してクロスポスト(`canonical_url` を元記事に設定)
- ネタ・ステータス管理はNotionの記事ネタDB、原稿はこのリポジトリ

## ディレクトリ構成

```
articles/   Zenn の記事 (zenn-cli)
books/      Zenn の本
public/     Qiita の記事 (qiita-cli)
devto/      dev.to 向け英訳記事
scripts/    dev.to 投稿スクリプト
```

## 使い方

### Zenn

```bash
npx zenn new:article --slug my-article --title "タイトル" --type tech
npx zenn preview                 # http://localhost:8000
```

GitHub連携済みのため、mainへpushすると `published: true` の記事が自動公開される。

### Qiita

```bash
npx qiita login                  # 初回のみ(アクセストークンを設定)
npx qiita new my-article
npx qiita preview                # http://localhost:8888
npx qiita publish my-article     # 公開
```

`.github/workflows/publish.yml` により、mainへpushでも公開される(リポジトリのSecretsに `QIITA_TOKEN` が必要)。

### dev.to

```bash
node --env-file=.env scripts/publish-devto.mjs devto/my-article.md
```

frontmatterの `published: false` なら下書き投稿。投稿後は `devto_id` が自動で書き込まれ、以降は同コマンドで更新になる。APIキーは dev.to の Settings → Extensions で発行。
