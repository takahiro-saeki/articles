# 2026年8月の記事公開スケジュール

8月1日から10日までを記事投稿強化期間とする。日本語記事の公開後、確定したURLをcanonical URLに設定してdev.toの英訳版を同日に公開する。

| 日付 | 媒体 | 日本語記事 | dev.to | 状態 |
| --- | --- | --- | --- | --- |
| 8月1日 | Qiita | Expo SDK 54なのにSDK 55向けパッケージが混ざり、Androidビルドが失敗したときの直し方 | 英訳版 | 公開済み |
| 8月2日 | Qiita | Expo Routerで通知タップからcold startするとスプラッシュ画面で固まった原因 | 英訳版を同日公開 | 公開待ち |
| 8月3日 | Zenn | Expoアプリを日本語から日英中対応へ段階的に移行した記録 | 英訳版を同日公開 | 公開待ち |
| 8月4日 | Qiita | expo-notificationsで「通知から起動」と「起動後の通知タップ」を分けて処理する | 英訳版を同日公開 | 公開待ち |
| 8月5日 | Qiita | Expo RouterでWebの招待リンクをそのままアプリの招待画面として開く | 英訳版を同日公開 | 公開待ち |
| 8月6日 | Zenn | EAS Update導入後のproduction、preview、runtimeVersion運用 | 英訳版を同日公開 | 公開待ち |
| 8月7日 | Qiita | React Nativeで招待QRコードをPNGにして共有する | 英訳版を同日公開 | 公開待ち |
| 8月8日 | Qiita | React Nativeの共有プレビューが画面外へはみ出し、ScrollViewも動かなかった原因 | 英訳版を同日公開 | 公開待ち |
| 8月9日 | Zenn | Webとモバイルで共通機能を作るとき、どこまでmonorepoで共有するか | 英訳版を同日公開 | 公開待ち |
| 8月10日 | Qiita | Cloudflare Cron Triggersをローカル実行して通知処理をテストする | 英訳版を同日公開 | 公開待ち |

## 公開手順

### Qiitaの日

1. 対象記事を最終確認する
2. `ignorePublish`を`false`へ変更する
3. `npx qiita publish <slug>`で公開する
4. Qiitaの公開URLを英訳版の`canonical_url`へ設定する
5. dev.toの英訳版を公開する
6. 公開URLと状態をこの表へ反映する

### Zennの日

1. 対象記事を最終確認する
2. `published`を`true`へ変更してmainへ反映する
3. Zennの公開を確認する
4. Zennの公開URLを英訳版の`canonical_url`へ設定する
5. dev.toの英訳版を公開する
6. 公開URLと状態をこの表へ反映する

## 公開済みURL

- 8月1日 Qiita: https://qiita.com/hiro123/items/c6e645cc27c4e2a6f919
- 8月1日 dev.to: https://dev.to/hirodeath/how-i-fixed-an-expo-sdk-54-android-build-with-sdk-55-packages-mixed-in-19d
