# 第13バッチ: Planeの作業記録と、日程取込・音解析の境界

2026-09-11。P04、P09、P16、P18、O23、O24の日本語Qiita下書きと、内容を保ったdev.to英訳を作成した。6組とも本文・日英対訳・Humanizerまで検証済み。Qiitaの将来のIDを未取得のためcanonicalはnull、状態は「執筆中」。外部の下書き作成、公開、予約追加は行っていない。

このバッチ後は完成41/90、本文検証済み80/90、canonical待ち39。本文の検証が残る候補は10件、完成までの残りはURL待ちを含め49件。残る本文候補はT03、T26、T27、T29、T30、T32、T33、T35、T41、T43。

## 記事ごとの答えと確認範囲

| ID | 読者が持ち帰る答え | 確認したこと | 確認していないこと |
| --- | --- | --- | --- |
| P04 | 状態の表示名を付ける前に、完了条件とgroupを照合する | DRG・RECITAL・SQNは各5状態で組み合わせ一致、IDは15個すべて別。実在するSQN-30の範囲と固定文書。掲載分類例の正常・group変更 | 設定の変更、共通化で困ったという過去の体験、Plane画面の集計値や滞留時間 |
| P09 | バージョン名のModuleと、確認した配布物の識別情報を分ける | SQNの通常・アーカイブModule各0。固定アプリ設定のversionとローカルビルド番号、EASのremote設定。提案JSONは未実行とnullを保持 | Module作成、EAS履歴・実配布物の番号、ストア提出、リリース成功 |
| P16 | 受け入れ条件と結果を対応させ、固定根拠へ戻れる本文を作る | SQN-30の範囲・停止位置、本文にリポジトリ参照なし、Git文書のWeb記録とモバイル実機未チェック | チケット更新、記録されたアプリ検証の再実行、Doneへの変更 |
| P18 | 取りやめの判断とアーカイブを分け、理由を捏造しない | cancelledクエリはSQN-22の1件。理由は本文から不明、SQNのアーカイブ済みWork Itemは0。停止していない他の範囲まで推定しない | Archive・復元の実操作、プロジェクト全体の終了、サービスや予約処理の停止 |
| O23 | 解析、フォーム反映、保存の再試行で再実行の意味が違う | 実コードによる8ケース。年補完の変化、2重行の保持、フォーム置換、保存途中失敗の代替DBで6行→再試行後13行・日付7種 | 実D1、ネットワーク断、実アプリの再送、CSV同期、元コードへの修正 |
| O24 | RMS、peak、周波数バイトを同じ尺度の音量と呼ばない | 実解析関数と実ブラウザOfflineAudioContextの4ケース。RMS比、211→232、ビン20/22、帯域集計の上半分不使用、8回のビート抑制 | マイク許可、ファイル再生、入力切替、全アプリ起動、FPS・長時間負荷・BPM精度 |

## 一次資料

準備Aの6候補を、個人用Plane、固定Git、公式資料から確認した。[repository-sources.json](repository-sources.json)に16ファイルのcommit、path、SHAと直近変更履歴を保存した。

- circle-hub-growth-07-schedule-import: `a34608c611ded6549c1176a7977e68e1bc62a8db`。共通解析器、既存テスト、Webとモバイルの貼り付けUI、Webフォーム、保存ルーター、グロース設計資料、アプリとEASの設定。remoteは個人所有のcircle-hub。実装履歴は`68bcd9522a87b34445aac511f403fc9f7be84145`。
- 同じGitオブジェクトの`0cda1e865ad80d1529197729d8d436e96d56edc7`: SQN-30の検証文書。文書追加は`12cbb78de5fdf2e7751b6c9f181cde88de3821c9`。公開原稿には開発用招待情報やテストアカウントを転記していない。
- beautiful-dashboard-for-bga: `6f69cac1fe792436fced3a5215633e850262db59`。AudioAnalysis、useAudioEngine、useAnimationFrame、README、lockfile。解析コードの追加履歴とREADMEの変更を確認した。
- [plane-snapshot.json](plane-snapshot.json): plane_personalの読み取り専用MCPによる状態・Module・アーカイブ一覧と必要なWork Item。ページの有無も保存。不要なユーザーID、移行元の非公開リンクは省いた。SQN-30は必要な本文だけをテキスト化した。

Planeには一切書き込んでいない。原稿では実際の設定、文書に書かれた過去の検証結果、今回新たに実行した試験、今後の導入案を区別した。

2026-09-11に現在の公式本文を確認した。

- [Plane states](https://docs.plane.so/core-concepts/issues/states): 名前とgroup、完了の分類、Governanceとの違い。
- [Plane Modules](https://docs.plane.so/core-concepts/modules): 機能・節目での分類と複数Moduleへの所属。
- [Plane Work Items](https://docs.plane.so/core-concepts/issues/overview): Links、Work Itemのアーカイブ。
- [Plane Projects](https://docs.plane.so/core-concepts/projects/overview): Projectのアーカイブ、検索・通常一覧からの除外、復元。
- [Expo app versions](https://docs.expo.dev/build-reference/app-versions/): 表示バージョンとビルド番号、remoteの値とローカル設定の関係。ローカルの番号を現在の配布版とみなさない根拠。
- [W3C Web Audio](https://www.w3.org/TR/webaudio/#AnalyserNode): frequencyBinCount、デシベルからバイトへの変換、平滑化と読み取り。

## 実験

環境はmacOS、Node.js 24.15.0、Asia/Tokyo。Web AudioはHeadlessChrome 152、OfflineAudioContextを使用した。アプリのlockfileはReact 19.2.4、Vite 7.3.1、TypeScript 5.9.3。ブラウザの生出力を[audio-browser-cli.txt](audio-browser-cli.txt)に保存した。ローカルHTTPサーバーと専用ブラウザセッションは終了済み。faviconの404だけがページのコンソールエラーで、解析モジュールと試験は読み込めている。

- [schedule-experiment.json](schedule-experiment.json): 実パーサーをNodeの型除去だけで実行。基準日の固定、重複2行、年をまたぐ推定、全角表記、不正日付・時刻と場所警告、51行上限、実フォーム関数、実createBulk関数の8ケース。保存試験は外部依存を代替したメモリ内試験で、DBトランザクションやD1障害の検証ではない。
- [audio-unit-experiment.json](audio-unit-experiment.json): 実AudioAnalysisを評価。ビン700だけが255の場合は帯域出力0、全バイト255なら各帯域1。無音、空配列、60回の履歴と8回の待機も確認した。
- [audio-browser-experiment.json](audio-browser-experiment.json): 468.75 Hzの合成正弦波、sampleRate 48000/44100、振幅0/0.25/0.5の4条件。0.5秒を停止要求時刻に指定した後、時間波形と周波数を一度読む。RMSとpeakには取得した元関数を使用。周波数側2048/0.85、時間側4096/0.8。先にfloat周波数を読み最大ビンを特定し、同じタイミングのバイトを読む。実入力や継続描画時の定常値として一般化しない。
- [snippet-verification.json](snippet-verification.json): 掲載JavaScript 4ブロックをそのまま実行し、JSON 1、text 3も日英照合。P04の分類変異、O23の掲載再現コード、O24のRMSとビン換算を検証。固定Gitのhashと、Planeで取得した件数・groupも照合。

再実行の入口:

```sh
node experiments/article-stock-2026-09/research-batch13.mjs
python3 experiments/article-stock-2026-09/verify-batch13-article-evidence.py
node scripts/validate-article-stock.mjs --batch=13 --allow-pending-canonical
npx zenn list:articles
git diff --check
```

research-batch13.mjsは外部の固定Gitを必要とし、`output/playwright/batch13-audio`へブラウザ用の元解析コードを生成する。ブラウザ試験を再実行する場合は、`experiments/article-stock-2026-09/audio-browser-batch13.mjs`をそのディレクトリの`probe.mjs`へコピーし、そこだけを127.0.0.1のローカルHTTPで配信する。Playwright CLIの専用セッションで開き、`async () => await window.articleProbe()`をevalする。マイクや外部サイトは不要。再実行時は保存済みJSONを成功結果として流用せず、新しい実行出力を検証する。

verify-batch13-article-evidence.pyは掲載コードを再実行するが、ブラウザを起動し直すものではない。ブラウザの保存済み測定値と記事の丸め値、理論上のRMS、ビン位置を照合する。

## 重複・対訳・Humanizer

P04はgroupによる分類、P09は配布物の識別に絞った。既存のCycle持ち越し記事やProject・Moduleの概念記事を再説明する構成にはしていない。P16は既存Pages記事と同じSQN-30を使うが、文書の置き場所ではなく、条件と結果の対応および起票時の未実行を扱う。P18の中心は取りやめ理由の欠落と保管操作で、既存のゲーム試作ファイル移動の記事とは異なる。

O23は実コードの貼り付け経路と再実行を扱い、既存D1原子性記事の実DB試験とは確認範囲が違う。O24は入力モックと解析尺度を扱う。タイトル重複なし。本文類似度は自動スクリーニングに加え、Pages、Cycle、TestFlightの記事と直接比較した。P16英訳の最寄りはPages記事だが、受け入れ条件と実行結果の表、起票用テンプレート、参照版の役割が今回の主題である。

日英それぞれ全節、表、具体例、結果、制約を照合し、英語版を要約にしていない。Humanizer v2.9.1のdraft→audit→finalを12原稿に適用し、24箇所を手動推敲した。重い対比、繰り返す説明予告、まとめを告げる文を直した。[humanizer-edits.json](humanizer-edits.json)に編集内容と意味の照合、[humanizer-audit.json](humanizer-audit.json)にfrontmatter・コード・数値・URLの不変と最終SHAを保存した。

## 完成ゲートと保護

- [content-validation.json](content-validation.json): 6組の本文ゲートは成功。未確定canonicalだけを明示して除外。
- [canonical-gate.json](canonical-gate.json): 例外なしの当該バッチ検証は未確定canonicalで失敗する。完成としては扱わない。
- [complete-validation.json](complete-validation.json): 完成41組の例外なし検証は成功。
- [zenn-list.txt](zenn-list.txt): Zenn一覧コマンド成功。
- [repository-guard.json](repository-guard.json): 制作開始前137ファイル、バッチ直前271記事ファイルがbyte一致。候補表は進捗ブロック以外を保持。
- 公開抑止はQiita ignorePublish=true/id=null、dev.to published=false。予約表・既存公開記事・workflowは無変更。

6組は本文検証済みとして進捗へ反映し、canonicalが解決するまで完成数へ加えない。
