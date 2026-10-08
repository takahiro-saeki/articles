# articles

技術記事の執筆・公開を一元管理するリポジトリ。Qiita / Zenn / dev.to の3プラットフォームをMarkdown + CLI/APIで運用する。

## 投稿方針

- **Zenn**: 毎週土曜日に1本。背景、設計判断、移行の経緯を扱う記事を選ぶ。
- **Qiita**: その他の日に日本語記事を1本。再現方法と確認結果を中心に扱う。
- **dev.to**: 日本語と内容を揃えた英語版を公開し、canonical_urlを日本語の実公開URLにする。
- 制作台帳と予約表、原稿をこのリポジトリで管理する。

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

GitHub連携済み。mainの `published: true` は公開要求であり、Zenn側の投稿上限などで実公開されない場合がある。公開ページを確認して完了とする。

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

## 90組の予約投稿（2026年9月〜12月）

2026-10-08の指示でZennを週1本（土曜）へ変更し、13本をQiitaへ移した。次回Zennは10/17。未公開だった4本を10/8〜10/11にQiitaで順次回復し、全90組の最終予定日は12/14。日本語1本/日、09:00 JSTを基準とする。GitHub Actionsの実行開始は遅れる場合がある。

- [日付・タイトルの一覧](schedule/ARTICLE_SCHEDULE_2026-09.md)
- [予約データ](schedule/publishing-schedule.json)
- [投稿頻度の設定](schedule/publishing-policy.json)
- [90組の制作進捗](ARTICLE_PRODUCTION_STATUS_2026-09.md)
- [移行・検証記録](production/2026-09/scheduling/weekly-zenn/README.md)
- [運用仕様と失敗時の対応](docs/features/scheduled-publishing/spec.md)

予約はmainの `Publish scheduled article` workflowが実行する。Zennの公開要求を先にpushし、日本語の公開確認後に英語版を公開する。Qiitaは公開APIから確定したURLをcanonicalへ設定する。公開済み英語版は保存したIDで更新する。

```bash
node scripts/publish-scheduled.mjs --date=2026-10-17 --dry-run
node --test scripts/publish-scheduled.test.mjs
node scripts/verify-article-schedule.mjs
```

失敗時は実ページと保存済みIDを確認してから、同workflowを対象日・dry_run=falseで再実行する。Zennの新規公開要求は土曜に限定する。公開に失敗したZennがある間は次の記事を開始せず、その記事を先に解決する。
