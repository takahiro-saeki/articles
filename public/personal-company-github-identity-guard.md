---
title: "GitHubの誤アカウントpushを防ぐ前提確認。hookの拒否と確認失敗を分ける"
tags:
  - GitHub
  - Git
  - ShellScript
private: false
updated_at: null
id: null
organization_url_name: null
slide: false
ignorePublish: true
---

個人用と会社用のGitHubアカウントを使う環境では、ディレクトリから期待するアカウントを決め、その実行環境で実際に使うアカウントを確認します。remoteのownerを見ただけでは、認証する主体は確定しません。

この個人開発環境にある確認hookを読み、`gh`と`git`をテスト用コマンドへ差し替えた6ケースで動かしました。誤アカウントを拒否するケースと、アカウント確認自体が失敗したケースで結果が違いました。

## 名前、APIの認証主体、push先を分ける

この環境の運用規約では、`~/Documents/GitHub`を個人領域、`~/work`を会社領域としています。個人領域で期待するGitHubアカウントは`takahiro-saeki`です。ディレクトリは期待値を選ぶための規約であり、移動するだけで認証が保証されるわけではありません。

Gitのコミット作者情報も、GitHub APIを呼ぶ資格情報とは別に確認します。[GitHub CLIの環境変数仕様](https://cli.github.com/manual/gh_help_environment)では、`GH_TOKEN`、`GITHUB_TOKEN`が保存済み資格情報より優先されます。保存済みアカウントを切り替えたつもりでも、現在のプロセスが違うトークンを持っていれば結果が変わります。

[gh api](https://cli.github.com/manual/gh_api)で`user`を呼び、`--jq .login`でその応答のloginだけを取り出します。トークンの値をログへ出す必要はありません。

## 既存hookの処理をローカルで確かめる

確認したファイルは`~/.Codex/hooks/check-github-account.sh`です。コマンド文字列が対象操作に当たる場合、作業ディレクトリとAPIのloginを比較し、会社アカウントを指すremoteなども調べます。

2026年9月11日のファイルを変更せずに実行しました。標準入力へ渡したコマンド文字列は検査対象のデータで、pushとして実行されません。偽の`gh`と`git`が返す値だけを変えています。

| 入力条件 | 既存hookの結果 |
| --- | --- |
| 個人アカウントと対象remoteが一致 | 拒否なし |
| 個人領域で会社アカウントを返す | 拒否 |
| アカウント取得が失敗して空になる | 拒否なし |
| 会社アカウントを指すremote | 拒否 |
| ownerは個人だが別リポジトリ | 拒否なし |
| 読み取り専用の`git status` | 対象外で拒否なし |

「拒否なし」は、その入力でhookがdenyを返さなかったという結果です。操作全体の安全性や、ホスト側でこのhookが登録・実行されることまでは証明していません。

取得失敗の行は、loginが空でない場合だけ不一致を拒否する実装から生じます。別リポジトリの行も、このhookが対象repoの完全一致までは要求していないためです。

## 読み取りによる前提確認は、取得失敗でも止める

今回の記事用に、次の読み取り専用チェックを用意しました。対象をこの個人リポジトリのHTTPS URLへ限定した例です。

```sh
expected_account=takahiro-saeki
expected_remote=https://github.com/takahiro-saeki/articles.git
actual_account=$(gh api user --jq .login) || exit 1
[ "$actual_account" = "$expected_account" ] || exit 1
actual_remote=$(git remote get-url --push origin) || exit 1
[ "$actual_remote" = "$expected_remote" ] || exit 1
printf '%s\n' 'identity and destination verified'
```

同じ6ケースで実行すると、正しいアカウントと正しいremoteの組だけが終了コード0、それ以外は終了コード1でした。アカウントを取得できなかった場合も停止します。この短い例にはpush処理を含めていません。

このチェックは既存hookを書き換えたものではありません。確認済みの値が、後続処理と同じ環境で使われることも必要です。別のシェルへ移り、資格情報やremoteを変更した後まで、過去の確認結果を流用できません。

## GitHub CLIの確認を、別の認証経路へ拡張しない

`gh api user`で確認したのはGitHub CLIが使う認証主体です。SSH鍵でpushする構成や、別のGit credential helperを使う構成まで同じアカウントだと結論づけることはできません。

実際の操作では認証経路も揃え、個人・会社の区分が不明なら操作前に解決します。操作後は対象リポジトリのownerと、意図したブランチへ反映されたcommitを確認します。ブラウザの表示名やコミット作者名だけでは、この確認を代替できません。

[6ケースの検証コード](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/identity-guard-batch12.py)と[結果・確認対象のSHA](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/production/2026-09/batch-12/identity-experiment.json)を保存しました。BashのhookとPOSIX shの確認例をmacOS上で実行し、実資格情報、実push、hook設定の変更は使っていません。ネットワーク障害時の実APIや全コマンド表記を網羅した試験ではないため、拒否例だけから完全な防止策と評価しないようにします。
