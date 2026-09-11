# 90組の下書き完成と90日分の予約

2026-09-12のユーザー指示で、Qiita向け49組のcanonicalを公開時に設定する運用と90日分の予約が承認された。全90組・180原稿が下書きとして完成。承認内容、日付、順序は[approved-plan.json](approved-plan.json)に保存した。

2026-09-12〜2026-12-10、毎日09:00（Asia/Tokyo）を基準に日英1組ずつ。日本語はZenn41本とQiita49本。優先12本を先頭に、その後は制作バッチ順・同バッチ内は候補表順とした。[日別一覧](../../../schedule/ARTICLE_SCHEDULE_2026-09.md)と[予約データ](../../../schedule/publishing-schedule.json)を参照。既存の38日分は内容を保持している。

9月12日の追加指示で開始を1日前倒しした。初日のP01は日英とも公開済み。翌日以降の89組は予約どおり公開する。[日付変更と初日の公開記録](start-today/README.md)を参照。以下の登録前検証とGitHubのdry-runは、変更前の予定を検証した記録として保持する。

## 登録前の検証

- 全90組のfrontmatter、抑止フラグ、タグ数、canonical方針、フェンス、実行コード、出典リンク、重複候補を検証。承認された49組のnullは完成条件を満たすが、英語版公開前にQiita応答URLで置き換える。
- `npx zenn list:articles` と `git diff --check` は成功。
- 全180原稿の最終hashは各バッチのHumanizer監査と一致。今回、180原稿の本文・公開フラグは変更していない。
- 全90日で実際のCLIを `--dry-run` 実行。90組の送信内容をメモリ上のAPIモックで照合し、タイトル、本文、タグ、canonicalを確認。原稿への書き込みと実際の外部投稿はない。
- Qiita失敗時に英語版へ進まないこと、英語版失敗後に保存済みの日本語IDで再試行すること、両言語公開済みならAPIを呼ばないことを確認。
- 投稿処理がJSON形式の引用文字列をデコードするよう修正。O02英語版タイトルにあったUnicodeエスケープの誤送信を、実原稿を使って再現し修正を検証した。
- 個人アカウント `takahiro-saeki` とremote ownerを確認。default branchはmain、予約workflowはactive、必要なSecret名 `QIITA_TOKEN` と `DEVTO_API_KEY` の登録を確認。Secretの値は読み出していない。
- main側で先行していたQiita CLIの更新commit `fec58e969398dca957569c29b6ada9a9782914f6` を取り込み、既存記事4本の更新日時・タグ表記を保持。main反映によって新規公開される、ignorePublishのないQiita下書きは0本。

[投稿処理の検証結果](publisher-verification.json)、[全90組の再照合](completion-audit/audit.json)、[原稿別hashと根拠](completion-audit/article-evidence.json)を保存した。承認前の判定と各バッチの実験日は上書きしていない。

## 実行環境と範囲

ローカル検証はNode.js v24.15.0。予約workflowはNode.js 22。模擬APIはローカルテスト専用で、認証情報の有効性や将来のサービス稼働を証明するものではない。GitHub Actionsの開始は予定時刻より遅れる場合がある。Zennは公開フラグをGitへ反映した後の同期となるため、dev.toと厳密に同時の公開ではない。

次のコマンドは下書き登録時点の検証用。公開開始後はfrontmatterとhashが変わるため、そのままの条件では成功しない。予約後の公開状態はworkflow実行結果と各原稿のfrontmatterで確認する。

```sh
node scripts/verify-article-schedule.mjs
python3 scripts/audit-article-stock-completion.py
node scripts/validate-article-stock.mjs --all
```

## GitHub上での有効化確認

予約と全180原稿をcommit `832172e636d5881e8a5dce1c2d7dbbacb629a0de` でmainへ反映。remoteの予約JSON、全原稿のGit blob、投稿スクリプト、workflowの一致を読み戻した。予約workflowはactive。[remote確認結果](remote-verification.json)を参照。

- [9月13日・Zennのdry-run](https://github.com/takahiro-saeki/articles/actions/runs/34656632842): 成功。P01の日英原稿を選択し、公開フラグはfalse、メタデータcommitはスキップ。
- [9月16日・Qiitaのdry-run](https://github.com/takahiro-saeki/articles/actions/runs/34656635434): 成功。T31の日英原稿を選択し、公開フラグはfalse、メタデータcommitはスキップ。
- [main反映時の既存Qiita workflow](https://github.com/takahiro-saeki/articles/actions/runs/34656612978): 成功。反映後も全180候補のGit blobは検証済み下書きと一致。

[GitHub Actions確認結果](github-actions-verification.json)に実行ID、対象日、対象ファイル、結果を保存した。これらは開始日前倒しと初日の本公開より前の確認実行である。
