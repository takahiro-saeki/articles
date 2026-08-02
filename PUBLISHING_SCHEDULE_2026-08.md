# 2026年8月の記事公開スケジュール

8月1日から25日まで毎日1本公開する。8月3日以降はGitHub Actionsが毎朝9時(Asia/Tokyo)に日本語版を公開し、確定したURLをcanonical URLに設定したdev.to英訳版も同日に公開する。

| 日付 | 媒体 | 日本語記事 | dev.to | 状態 |
| --- | --- | --- | --- | --- |
| 8月1日 | Qiita | Expo SDK 54なのにSDK 55向けパッケージが混ざり、Androidビルドが失敗したときの直し方 | 英訳版 | 公開済み |
| 8月2日 | Qiita | Expo Routerで通知タップからcold startするとスプラッシュ画面で固まった原因 | 英訳版 | 公開済み |
| 8月3日 | Zenn | Expoアプリを日本語から日英中対応へ段階的に移行した記録 | 英訳版 | 9時予約 |
| 8月4日 | Qiita | expo-notificationsで「通知から起動」と「起動後の通知タップ」を分けて処理する | 英訳版 | 9時予約 |
| 8月5日 | Qiita | Expo RouterでWebの招待リンクをそのままアプリの招待画面として開く | 英訳版 | 9時予約 |
| 8月6日 | Zenn | EAS Update導入後のproduction、preview、runtimeVersion運用 | 英訳版 | 9時予約 |
| 8月7日 | Qiita | React Nativeで招待QRコードをPNGにして共有する | 英訳版 | 9時予約 |
| 8月8日 | Qiita | React Nativeの共有プレビューが画面外へはみ出し、ScrollViewも動かなかった原因 | 英訳版 | 9時予約 |
| 8月9日 | Zenn | Webとモバイルで共通機能を作るとき、どこまでmonorepoで共有するか | 英訳版 | 9時予約 |
| 8月10日 | Qiita | Cloudflare Cron Triggersをローカル実行して通知処理をテストする | 英訳版 | 9時予約 |
| 8月11日 | Qiita | i18nextで文言だけでなく日付フォーマットも言語切り替えへ対応する | 英訳版 | 9時予約 |
| 8月12日 | Zenn | 定員、キャンセル待ち、代理入力がある出欠管理のデータ設計 | 英訳版 | 9時予約 |
| 8月13日 | Qiita | LINE内ブラウザを考慮してWeb URLとアプリDeep Linkを使い分けた | 英訳版 | 9時予約 |
| 8月14日 | Zenn | Next.jsとExpoで同じ認証、権限モデルを使うまでの設計変遷 | 英訳版 | 9時予約 |
| 8月15日 | Qiita | キャンセル待ちの繰り上げをクライアントではなくサーバーで確定させる理由 | 英訳版 | 9時予約 |
| 8月16日 | Zenn | 個人開発アプリをTestFlightへ継続的に出すためのリリース手順 | 英訳版 | 9時予約 |
| 8月17日 | Qiita | 外部生成APIの429をリトライしつつ、一部失敗を許容するバッチ設計 | 英訳版 | 9時予約 |
| 8月18日 | Qiita | ReactのsetState無限ループが画像プレビューで起きた原因 | 英訳版 | 9時予約 |
| 8月19日 | Zenn | AI生成したピクセルキャラクターをGodotへ取り込むパイプライン | 英訳版 | 9時予約 |
| 8月20日 | Qiita | キャラクター生成をキュー化して一括処理できるツールを作った | 英訳版 | 9時予約 |
| 8月21日 | Zenn | Godotで敵AI、物理挙動、マップ接続を自動テストする | 英訳版 | 9時予約 |
| 8月22日 | Zenn | メトロイドヴァニアのセーブデータをどう設計したか | 英訳版 | 9時予約 |
| 8月23日 | Zenn | ヒットストップ、剣閃、コンボ専用モーションで攻撃の手触りを改善する | 英訳版 | 9時予約 |
| 8月24日 | Zenn | AI生成素材をそのまま採用せず、ゲーム内で比較試遊できる仕組み | 英訳版 | 9時予約 |
| 8月25日 | Qiita | APIの部分失敗を許容し、成功した素材だけ保存する設計 | 英訳版 | 9時予約 |

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
- 8月2日 Qiita: https://qiita.com/hiro123/items/9917943f00ec1d6a7d2b
- 8月2日 dev.to: https://dev.to/hirodeath/why-my-expo-router-app-froze-on-the-splash-screen-after-a-cold-start-notification-tap-40d4
