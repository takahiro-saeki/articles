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

## 90日分の予約投稿（2026年9月〜12月）

2026年9月13日〜12月11日、毎日09:00（日本時間）を基準に、日本語1本とdev.to英語版1本の計90組を公開する。GitHub Actionsの実行開始が遅れる場合がある。

- [日付・タイトルの一覧](schedule/ARTICLE_SCHEDULE_2026-09.md)
- [予約データ](schedule/publishing-schedule.json)
- [90組の制作進捗](ARTICLE_PRODUCTION_STATUS_2026-09.md)
- [承認・検証記録](production/2026-09/scheduling/README.md)

予約はdefault branchの `Publish scheduled article` workflowが実行する。原稿の公開フラグは予約登録時には変えず、対象日の処理で変更する。Qiitaの英語版は、同日の日本語版を作成した応答からcanonical URLを設定する。

公開せずに特定日の選択結果を確認するには、次を実行する。

```bash
node scripts/publish-scheduled.mjs --date=2026-09-13 --dry-run
```

失敗日の再試行はGitHub Actionsの `Publish scheduled article` を対象日で手動実行する。確認時は `dry_run: true`、公開を再試行するときは `dry_run: false`。公開済みのIDは再利用される。API成功後に応答やメタデータ保存が失われた場合は、二重投稿を避けるため公開先を先に確認する。
