---
title: "2サービスの保守を、Web・OTA・ネイティブの配布経路で棚卸しする"
emoji: "🛠️"
type: "idea"
topics: ["個人開発", "expo", "nextjs", "運用"]
published: false
---

同じNext.jsとExpoを使うサービスが二つあっても、同じコマンドと確認項目だけで保守できるとは限りません。設定名が同じでも、配布先やAPIの接続先が違う場合があります。

SquadNoteとVoices Diaryのリポジトリを読むと、その違いが`preview`という名前にも出ていました。前者はinternal配布、後者はstore配布です。どちらもAPI接続先は本番のドメインでした。「previewだから本番データへ触れない」とは判断できません。

保守の量を把握するには、サービスの数に加えて、変更を届ける経路と、その先で必要な確認を一覧にします。この記事は作業時間が何倍になったという体験談ではなく、2026年9月11日に固定ソースから行った棚卸しです。

## 古いREADMEを現在の構成として数えない

確認したのはSquadNoteの`d116e8a`と、Voices Diaryの`6143bb9`です。作業中のファイルは取り込まず、Gitのコミットを指定して読みました。

Voices DiaryのルートREADMEには、Webのみ、実装未着手という初期の説明が残っていました。しかし同じコミットには`apps/web`と`apps/mobile`があり、モバイル版の設定、認証画面、通知処理があります。9月4日の`6143bb9`は、iOS認証後の画面遷移を変更した履歴です。

このREADMEから「モバイル保守はまだ不要」と判断すると、実装と合いません。反対に、設定ファイルがあることから「ストア上の全端末がこの版」とも判断できません。今回見ているのは、固定されたリポジトリの構成です。

[Voices Diaryの固定時点](https://github.com/takahiro-saeki/voice-training-log/tree/6143bb99873ccf04b134dad4ac6b12c6e7a02d48)と[SquadNoteの固定時点](https://github.com/takahiro-saeki/circle-hub/tree/d116e8a343e8d9e7ddd3d1985efe590fa1901868)を基準に、配信済みの状態が必要な項目は未確認として分けました。

## 同じpreviewでも、配布と接続先は別に読む

`apps/mobile/eas.json`と`app.config.ts`から、保守で見落としたくない項目を抜き出しました。

| 項目 | SquadNote | Voices Diary |
| --- | --- | --- |
| app.configのversion | 1.0.13 | 1.1.0 |
| runtimeVersionのpolicy | appVersion | fingerprint |
| previewのdistribution | internal | store |
| previewのchannel | preview | preview |
| previewのAPI | 本番ドメイン | 本番ドメイン |
| 開発用APIを使うbuild profile | development、qa | development |

表のversionはストアの最新版ではなく、読んだファイルの値です。`preview`のAPIはそれぞれ`squad-note.com`、`voicesdiary.com`でした。配布方法、更新channel、APIの環境は、名前一つで代用せず別々に確認します。

両方でExpoを使っていても、配布手順をコピーする前に設定を照合します。たとえば確認用ビルドを作る場合、最初に決めるのは「previewという名前を使うか」より、どのAPIへ接続し、どのバイナリへ何を配るかです。

## Web、OTA、ネイティブ変更で完了の証拠が違う

Voices DiaryのTestFlightランブックには、Webの反映、JavaScriptの更新、ネイティブ変更時の再ビルドが分けて書かれています。この分類を、二つのサービスの保守表にも使えます。

| 変更の入口 | 確認対象の例 | 終了を判断するために残すもの |
| --- | --- | --- |
| Web・API | 認証、権限、データ形式 | 対象コミットと環境、そのAPIを使うクライアントの結果 |
| OTA | JS側の画面や通知設定処理 | 対象runtime、channel、適用した端末での結果 |
| ネイティブビルド | URL scheme、native依存、OS側設定 | 新しいバイナリの識別情報と端末での結果 |
| 配布後の説明 | ストア文面、操作案内、保守文書 | 説明が対象版と一致している確認 |

この表は今後の記録方法です。今回、デプロイやOTA、ストア提出を実行したわけではありません。

[Expoのruntime versionの説明](https://docs.expo.dev/eas-update/runtime-versions/)では、更新とネイティブ側の互換性をruntimeで扱います。SquadNoteの`appVersion`とVoices Diaryの`fingerprint`は、その決め方が異なります。runtimeが一致することを、JSの動作やAPIとの互換性まで保証するものとして扱いません。

具体例はVoices Diaryの9月4日の変更です。ログイン成功後のAlertや画面遷移を待つJS側の処理に加え、`CFBundleURLTypes`へアプリ本体のschemeも明示しています。後者はiOSの設定に関わります。「ログイン画面の修正」という題名だけで、OTAのみで全変更が反映できると決めることはできません。今回、その変更がどの配信済みバイナリへ入っているかは確認していません。

## 通知という同じ名前にも、別の確認がある

二つのサービスの通知処理を読むと、対象も違います。

SquadNoteには、ユーザーの通知設定と登録端末を使ったPush送信があります。Voices Diaryには、端末内に設定を保存する曜日別ローカルリマインダーと、管理者だけが使うリモート通知の経路テストがあります。後者を一般ユーザー向けの自動配信機能と数えるのは誤りです。

[Voices Diaryのリモート通知仕様](https://github.com/takahiro-saeki/voice-training-log/blob/6143bb99873ccf04b134dad4ac6b12c6e7a02d48/docs/17-remote-notification-test.md)では、端末登録、送信、receiptの確認を扱います。実装でもメールallowlistの確認と、Expoのticket、receiptに応じた状態がありました。端末に表示されたかは、その状態だけでは分かりません。

通知の保守という一行を、そのまま両サービスへ複製するより、確認対象を具体化します。SquadNoteなら他端末の登録を消していないか。Voices Diaryのローカル通知なら選んだ曜日だけが登録されるか。管理者テストなら対象外ユーザーが送信できないか。同じライブラリを使っていても、受け入れ条件が違います。

## 棚卸しから得たのは、時間ではなく確認先

今回の確認は設定とソースの静的な照合です。20ファイルについて固定コミットとhashを記録しました。実端末での通知、OAuth、ストア配布状況、保守に使った時間は測っていません。

この棚卸しから、共通化できる記録の書式と、サービスごとに確認する設定を分けられます。配布経路ごとに証拠を残す書式は共有できます。接続先、runtimeの決め方、通知の対象、公開案内は各サービスで確認する必要があります。

次の保守タスクでは「どのサービスか」に加え、「どの経路で反映し、どの端末・環境で何を確認したら終わるか」を書きます。二つのリポジトリへ同じ修正を適用できたとしても、その先の確認が二つとも終わったことは、別に記録します。
