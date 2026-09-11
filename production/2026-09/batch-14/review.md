# 第14バッチ: API境界、モバイル保存・通知、AASAとEASの確認範囲

2026-09-11。T03、T26、T27、T30、T33の日本語Qiita下書きと、内容を保ったdev.to英訳を作成した。5組とも本文・日英対訳・Humanizerまで検証済み。Qiitaの将来のIDが未確定のためcanonicalはnull、状態は「執筆中」。外部の下書き作成、公開、予約追加は行っていない。

このバッチ後は完成41/90、本文検証済み85/90、canonical待ち44。本文の検証が残る候補はT29、T32、T35、T41、T43の5件。完成までの残りはURL待ちを含め49件。

## 記事ごとの答えと確認範囲

| ID | 読者が持ち帰る答え | 確認したこと | 確認していないこと |
| --- | --- | --- | --- |
| T03 | unknownは利用前の検査を促す型で、JSONの形を実行時に調べるのは検査コード | any・unknown・asのコンパイル差、TypeError、実Push関数の代替依存による6応答、提案statusガード6入力 | 完全なExpo応答検証、実送信、実DB、元コードの修正 |
| T26 | 保存時の機密性と、読めなくなったときの復旧を別々に決める | 現在の公式仕様と固定SDKの違い、実getTokenの例外伝播、提案ラッパーのvalue/missing/unavailable | ネイティブ暗号化、生体認証、移行、再インストール、容量の実測 |
| T27 | トークンを受け付けるサービスと、取得APIを対応させる | Expo・FCM・APNsの公式経路、iOSのFirebase登録経路、固定クライアントとサーバー、宛先型3ケース | 実トークン取得、資格情報変更、送信・配送・端末表示 |
| T30 | HTTP 200の後に、設定上のアプリ識別子と対象パスを照合する | 本番・開発AASAの匿名GET、両方125バイトで同一、開発ID欠落、固定設定評価、限定チェッカー10条件、掲載curlの実行 | 署名済みentitlements、Apple CDN、実機、swcutil、設定修正 |
| T33 | Build・Submit・Updateの成功を、できたものとストアや端末の後続状態に分ける | 現在の公式仕様、固定scriptsとeas.json、アプリ設定の評価、掲載JSONの一致 | EASコマンド、ビルド・アップロード・更新配信、費用・時間・到達率 |

## 一次資料と固定コード

準備AのT03は、個人リポジトリの実コードとGit履歴を確認した。準備BのT26・T27・T33は現在の公式資料を確認し、題材の実装済み範囲を固定コードと照合した。準備CのT30は実HTTP取得と条件を変えたローカル比較を実行した。

リポジトリはcircle-hub-growth-07-schedule-import、remoteは個人所有のcircle-hub。固定commitは`a34608c611ded6549c1176a7977e68e1bc62a8db`。[repository-sources.json](repository-sources.json)に10ファイルのpath、commit、SHA、バイト数、直近変更履歴を保存した。Push送信、保存・認証・言語・通知、アプリ設定、AASAルート、eas.json、package.json、グロース設計資料が対象。参照元リポジトリへの変更はない。

2026-09-11に現在の公式本文を確認した。

- [TypeScript unknown](https://www.typescriptlang.org/docs/handbook/2/functions.html#unknown)と[型アサーション](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#type-assertions): unknownの操作制限と、asに実行時検査がないこと。
- [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/): OS保存機構、アンインストール・生体認証・Androidバックアップ・大きな値の制約。約2048バイトは過去の一部iOSの記述で、全環境の固定上限にはしない。
- [AsyncStorage公式リポジトリ](https://github.com/react-native-async-storage/async-storage)と[3.0利用説明](https://react-native-async-storage.github.io/3.0/api/usage/): 暗号化しない保存、createAsyncStorageと文字列・nullのAPI。旧形式のimportを現行APIとして掲載していない。
- [Expo Notifications](https://docs.expo.dev/versions/latest/sdk/notifications/)と[Push送信](https://docs.expo.dev/push-notifications/sending-notifications/): Expo・ネイティブ取得API、ExpoからFCM/APNsへの経路、ticketとreceiptの区別。
- [Firebase iOS設定](https://firebase.google.com/docs/cloud-messaging/ios/get-started): iOSでもFCMを使えることと、APNs Tokenとの対応付け。
- [Apple TN3155](https://developer.apple.com/documentation/technotes/tn3155-debugging-universal-links): AASAの配信・識別子・検証、Apple CDNと端末側の確認。JavaScript表示ページの本文はApple自身のtutorials/data/documentation/technotes/tn3155-debugging-universal-links.jsonから取得して読んだ。
- [Appleのlegacy Universal Links仕様](https://developer.apple.com/library/archive/documentation/General/Conceptual/AppSearch/UniversalLinks.html): appID/paths、大小文字、query・fragment、パス規則。今回の限定チェッカーは除外やcomponentsを実装していない。
- [EAS Build](https://docs.expo.dev/build/introduction/)、[Submit](https://docs.expo.dev/deploy/submit-to-app-stores/)、[Update](https://docs.expo.dev/eas-update/introduction/)、[SplashScreen設定](https://docs.expo.dev/versions/latest/sdk/splash-screen/): 生成物、提出先の状態、非ネイティブ更新と新しいバイナリが必要な変更。AndroidのSubmitが公開状態へ影響しないとは断定しない。

最新ドキュメントの推奨版はSecureStore ~57.0.3、Notifications ~57.0.17。固定アプリの宣言はExpo ~54.0.33、SecureStore ~15.0.3、Notifications ~0.32.17、Updates ~29.0.12。前者を固定アプリのインストール環境として記述していない。AsyncStorageの直接依存はない。

## 実験と掲載コード

環境はmacOS 26.6.2、Node.js 24.15.0、TypeScript 7.0.2、Asia/Tokyo。コンパイル比較はstrict、ES2022、noEmit、types=[]。TypeScript CLIを既存のlanguage-batch08の依存から呼び、コンパイル用の一時ディレクトリは削除した。Nodeの型除去は実験的APIの警告を出すが、各試験は成功している。

- [unknown-experiment.json](unknown-experiment.json): any/asはコンパイルが通るがTypeError、unknownはTS18046。実sendExpoPushを取得し、fetch・DB・ログだけを代替した6応答では、dataがオブジェクトとstatusが数値のケースはログなし・削除なしでfulfilled。応答全体nullとHTTP 503はログ1、DeviceNotRegisteredはログ1・削除1。提案ガードは正常配列・空配列を許容し、他4入力を拒否する。
- [storage-experiment.json](storage-experiment.json): 提案ラッパーの3結果は各読み取り1回。固定getTokenは代替保存層の例外をrejectする。ネイティブ保存を再現した試験ではない。
- [token-routing-experiment.json](token-routing-experiment.json): Expo宛先は通り、APNs/FCM宛先はどちらもTS2322。型はトークンの真正性を証明せず、通知送信も行わない。
- [aasa-http-observations.json](aasa-http-observations.json): 本番と開発のGETは両方200・application/json、125バイト、SHA一致。本番アプリIDのみを含む。認証なし・リダイレクト追跡なし。
- [aasa-curl-observation.json](aasa-curl-observation.json): 掲載curlを記事から抽出してそのまま一時ディレクトリで実行した。初回取得と同じ本文hash。保存ヘッダーと本文を記録し、一時ファイルは削除した。
- [aasa-experiment.json](aasa-experiment.json): 固定設定をAPP_ENVだけの代替環境で評価。開発版のappIDが見つからない。3本の正のlegacy接頭辞規則に限り、HTTP・JSON・識別子・パスを変えた10条件を比較。未対応componentsを不正なAASAとみなさない。swcutilはrootが必要でsudo -nがパスワード要求として終了したため未実行。署名付きentitlements、Apple CDN、端末では検証していない。
- [eas-config-analysis.json](eas-config-analysis.json): 固定scripts、channel・internal・autoIncrement、アプリ設定を読み取り。productionのdistributionは省略されているためnullで記録し、実験側で既定値を補わない。EASコマンドは実行していない。
- [snippet-verification.json](snippet-verification.json): 日英の全8コードブロック一致。実行用5、JSON 2、text 1。掲載anyコードのコンパイルとTypeError、unknownへの変更、ガード6入力、保存3入力、宛先型3条件と生成JSONを照合した。掲載curlの保存済み実行記録、AASAのpaths、EAS scripts、固定Gitの10hashも確認した。

再実行の入口:

```sh
node experiments/article-stock-2026-09/research-batch14.mjs
python3 experiments/article-stock-2026-09/verify-batch14-article-evidence.py
node scripts/validate-article-stock.mjs --batch=14 --allow-pending-canonical
npx zenn list:articles
git diff --check
```

research-batch14.mjsは固定Git、既存TypeScript CLI、保存済みHTTP観測を使い、外部通信を行わない。実HTTP取得をやり直す場合はcapture-aasa-batch14.pyを使う。通常実行は2ドメインの観測を取り直し、記事掲載curlも実行する。--curl-onlyは掲載curlだけを実行する。後日の取得結果で元の観測日を上書きした実績にしない。

verify-batch14-article-evidence.pyは掲載コードを再実行するが、AASAを再取得したりAppleの検証を実行したりするものではない。保存済みcurlのコマンド・本文と掲載内容を照合する。

## 重複・対訳・Humanizer

タイトル重複なし。本文類似度の自動スクリーニングに加え、既存のEAS runtimeVersion運用記事、Expo Router招待Universal Links記事、前バッチのバージョンModule記事を比較した。T30はAASAのHTTP取得と開発識別子の不一致、T33はコマンド成功の意味を中心にした。元の記事の構築手順や運用全体を繰り返していない。T03はsatisfiesの型推論の比較ではなく、実際の外部応答で検査が欠ける場合を扱う。

日英全節・表・具体例・結果・制約を照合し、英語版を要約にしていない。Humanizer v2.9.1のdraft→audit→finalを10原稿へ適用し、2回のレビューで計34箇所を手動推敲した。最後に研究・実験を著者本人の一人称の体験として読める表現も除いた。AIの定型的な予告や対比を減らし、観測と未確認範囲を保った。

[humanizer-edits.json](humanizer-edits.json)と[humanizer-followup-edits.json](humanizer-followup-edits.json)に編集、pass1/pass2のauditに各変更前後のhash、[humanizer-audit.json](humanizer-audit.json)に通算の最終hashを保存した。2段階のhash連鎖は一致し、frontmatter・コード・数値・URLは両段階とも不変。

## 完成ゲートと保護

- [content-validation.json](content-validation.json): 5組の本文ゲート成功。未確定canonicalだけを明示して除外。
- [canonical-gate.json](canonical-gate.json): 例外なしでは未確定canonicalで失敗することを確認。完成としては扱わない。
- [complete-validation.json](complete-validation.json): 完成41組の例外なし検証成功。
- [zenn-list.txt](zenn-list.txt): Zenn一覧コマンド成功。
- [repository-guard.json](repository-guard.json): 制作開始前137ファイル、バッチ直前283記事ファイルがbyte一致。候補表は進捗ブロック以外を保持。
- 公開抑止はQiita ignorePublish=true/id=null、dev.to published=false。予約表・既存公開記事・workflowは無変更。

5組を本文検証済みとして進捗へ反映し、canonicalが解決するまで完成数へ加えない。
