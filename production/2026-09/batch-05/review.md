# Batch 05: ゲーム制作記録とアプリの移行・復旧

確認日: 2026-09-11。O13/O15/O16/O20/O21/O22の日英6組。すべてZenn向け。完成時点で29/90件、残り61件。先に書きたい12本は9件完成。T01/T31/T37は本文あり・Qiita canonical未確定のまま、完成に数えない。

## 記事ごとの答えと確認範囲

| ID | 読者に渡す答え | 今回の確認 | 限界 |
| --- | --- | --- | --- |
| O13 | 入力対応は画面と一押しの意味を決めて確認する | 固定ソースの画面分岐、入力種別、共通binding履歴。元クラスと抽出したmotion関数をGodotで実行し、10イベント・再割当3観点を確認 | ブラウザ、タッチ由来mouseイベント、実gamepad接続、全画面の入力、操作感は未検証。追加順を捏造しない |
| O15 | 採用記録を曲名からキー・実ファイルへ追い、数えた単位を残す | BGM18スロット/17異なるファイル、ジングル込み18、保管19。全ファイル存在、SHA-256、ffprobe。選択関数・loop指定を読む | 過去のSuno候補尺と採用理由は文書記録。今回は聴感、LUFS、シームレス接続、生成APIを確認していない |
| O16 | 伝える順序を区間表へ置き、指定尺と完成動画を別に確かめる | V1/V2ソース、11区間の連続性、game表示予定51.5秒。区間関数の22assertions。Git内MP4の63.033333/60.000000秒とcodec等 | 映像を再レンダーしていない。全frame目視、聴き比べ、視聴効果、duration差の原因特定はなし |
| O20 | 旧server/旧logout/適用済みclient/再登録を分けて移行を確認する | 変更前後の実tRPCとin-memory libSQLで4組合せ。既存8件と合わせ12テスト成功 | clientのAPI選択を模したテスト。実端末、OTA配布・適用、Expo以降の配送はなし。仕様書の実機欄は未チェック |
| O21 | Configurationという表面の分類から原因を断定せず、再試行と診断を検証する | 固定source8ファイル47テスト。実Auth coreのPKCE欠落→302/Configuration/InvalidCheck、再開始S256。ガード・戻り先・診断分離・秘密非出力 | 実OAuthプロバイダ、本番ログ、実ブラウザはなし。開始fixtureは内部CSRF skipを使う。診断markerは認証根拠でない |
| O22 | 本人の識別と、回答一件の操作権を分け、明示してアカウントへ移す | 3ファイル15テスト。実乱数/hash、実routerをDB/通知mockで呼出し。失敗時・claim・公開情報の境界、Web保存を確認 | D1のSQL条件評価、複数process競合、SecureStore実機、XSS全体監査なし。名簿や別端末同期は将来機能 |

## 一次資料と固定した履歴

- game-jam-lab: `f074703848586828b6a5acc0e465ccdd2c0d5244`。元のワークツリーには別の作業の変更があるため、Gitの固定内容のみ取得。
- O13: `godot/shared/controller_bindings.gd`、`charge_clicker.gd`の入力ルーティング、motion latch。共通gamepad追加`ef5cb81`（8/1）、Project Charge原型`b3be93e`（8/2）を確認。「マウス→タッチ→gamepad」という順序の体験談へ変換しない。
- O15: `docs/SUNO_MUSIC_BRIEF.md`、BGMStreams/EncounterBGMKeys/desired_bgm_key/refresh_music、19音声。候補記録`5ab837b`、敵別実装`290d302`、後続追加の履歴。初期マスタリングやA/B選択は元文書の記録として扱う。
- O16: `bf5c7e7`の初版と`f074703`の第2版、`49a5e18`の変更履歴。`godot/tools/trailer_capture.gd`、`submission/trailer/README.md`、`tools/compose-trailer.sh`、Git内MP4二本。
- circle-hub-multi-device-push: `0cda1e865ad80d1529197729d8d436e96d56edc7`、変更`ad0a669`とその親のnotification router、モバイルの変更と`docs/multi-device-push.md`。台数保持の実装は既存T28と重なるため、今回4組合せの移行試験を追加した。
- circle-hub-auth-recovery: `d116e8a343e8d9e7ddd3d1985efe590fa1901868`。復旧画面`061a5f2`、同期ガード`2b88c31`、診断`7f180ad`。`docs/auth-recovery-diagnostics.md`と各実装・テスト。本番障害をユーザーが起こしたという候補タイトルは採用しない。
- circle-hub-growth-06-guest-identity: `9aec48963842dcaf16ce49c80317366509ab1b8f`。設計、0007 migration、ownership関数、attendance router、Web保存とmy-schedulesの明示claimボタン。移行SQLと条件付き更新はコードを確認した範囲で説明する。

## 外部の公式資料

- [Godot InputEvent](https://docs.godotengine.org/en/stable/tutorials/inputs/inputevent.html): Viewport配送、set_input_as_handled、InputMap。関数内returnは別に必要。
- [Godot AudioStreamMP3](https://docs.godotengine.org/en/stable/classes/class_audiostreammp3.html): loopプロパティ。loop=trueから聴感を保証しない。
- [FFmpeg volume](https://ffmpeg.org/ffmpeg-filters.html#volume): 0.63は入力倍率で約-4dB。ラウドネス正規化の実測値ではない。
- [Expo runtime versions](https://docs.expo.dev/eas-update/runtime-versions/): updateとnative binaryの互換性。同じ識別子だけでnative構成が同じになるわけではない。
- [Auth.js InvalidCheck](https://authjs.dev/reference/core/errors#invalidcheck): PKCE/state/nonceの検査不能。表面のConfigurationだけから原因を推定しない。
- [Web Crypto getRandomValues](https://www.w3.org/TR/webcrypto/#Crypto-method-getRandomValues): 暗号学的に強い乱数。人物の本人性を証明するAPIではない。
- [OWASP HTML5 storage](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html#local-storage): JavaScriptから読み取れる保存領域の制約。現行実装のlocalStorageを安全一般として推奨しない。

## 実行証跡

- [circle-tests-summary.json](circle-tests-summary.json): Node v24.15.0、Vitest4.1.4、Next15.5.15、next-auth5.0.0-beta.25、同依存Auth core0.37.2。対象ソースはそれぞれ固定commitから一時archiveへ取り出し、既存依存runtimeを使用。キャッシュはscratchへ配置。
- [push-tests.json](push-tests.json): 12件成功。元の8件と追加の4組合せ。古い登録では後勝ち1件、新しい登録では2件。全解除は新serverでも0、端末別解除とnew serverだけ他端末1件を維持。いずれも追加登録で対象が戻る。実通知HTTPはmock。
- [auth-tests.json](auth-tests.json): 47件成功。実Auth core2ケース、diagnostics8、route2、notification4、redirect18、submission guard3、oauth actions6、error copy4。合計47。実行したテスト名を保存。ブラウザでのJS無効操作の完全再現ではなく、対応action分岐の試験も含む。
- [guest-tests.json](guest-tests.json): 15件成功。token3、mock DBを使う実router9、Web store3。SQL条件の評価や実D1の耐競合性の証拠に流用しない。
- [game-input.json](game-input.json): Godot4.6.2.stable.official.71f334935。元binding classと抽出した元motion関数。合成10イベントで中立への復帰、保持中、正→負直接移動、X/Y独立を確認。ボタン衝突swap、無効値拒否、キーボード保持も確認。設定の保存なし。
- [game-media.json](game-media.json): ffprobe9.0.1。音声19件とMP4二本をGitから一時的に取り出して形式・尺を読む。BGM18slot/17file、jingle込み18、旧地図曲1件が現在のBGM辞書で未参照。音声はすべて48kHz/2ch。ジングルMP3内には埋め込み画像のvideo streamもあるため、音声streamだけで説明。
- [trailer-boundaries.json](trailer-boundaries.json): 実beat_index_atを変更せずGodotで実行。10境界の直前/一致と開始/終端、計22assertions成功。harnessのインデントを元コードと同じtabへ修正後に成功。動画再生成はしていない。
- [snippet-verification.json](snippet-verification.json): 全掲載TS/GDScriptを固定元sourceへ空白正規化して照合。O15は再生コードの静的照合、O22はmethod chain断片で単独実行ではない。日英の音声duration、動画durationも保存済みデータへ照合。

実行順はarticlesルートから次のとおり。関連個人repoが同階層にあり、そのNode依存、Godot、ffprobeが利用できる前提。公開・通知・画像/音楽生成・メディア変換は行わない。

```bash
python3 experiments/article-stock-2026-09/batch05-circle-tests.py
python3 experiments/article-stock-2026-09/game-input-media-evidence.py
python3 experiments/article-stock-2026-09/trailer-boundary-check.py
python3 experiments/article-stock-2026-09/verify-batch05-snippets.py
```

## 重複と英訳の確認

日英タイトルに完全一致なし。baselineとこれまでの新規記事へ4文字gramで比較し、近い本文を直接確認。スコアは候補抽出用であり、自動合否ではない。

- O13は既存のゲーム紹介の四入力対応から、画面別の消費と一押しのラッチ、再割当でのkeyboard保持へ絞った。キャンペーン全経路監査の記事と異なり、合成InputEventの局所検証を扱う。
- O15は画像候補のprovenance記事から、音楽の役割キーと実体数、共有曲・旧曲、尺とloopの別判定へ変えた。Suno候補をすべて今回聴いたという体験にはしない。
- O16は提出物キットの記事から、初版/第2版のタイムライン変更、区間境界の実行、指定尺とMP4尺の照合へ変えた。既存記事の成果物紹介だけを繰り返さない。
- O20はT28で説明したupsert・端末別解除・端末内直列化の再説明を避け、実routerの4組合せで配布の非対称性と再登録を検証。T28の旧版互換の短い節を、移行確認の独立した実験へ展開。
- O21は既存のWeb/Expo認証の構成やJWTから、失敗分類、復旧画面、開始ガード、診断の証拠へ変更。未読の本番ログで因果を作らない。
- O22は出欠人数や待機列の制御ではなく、回答一件の操作権とアカウントへの移譲を扱う。将来の名簿構想を実装済みとしない。

全6組の問題・調べ方・例・結果・制約を英語版へ保持。O13のaxis入力、O15の18/17/18/19とduration、O16の前後タイムラインと22assertions、O20の4行matrixと12件、O21のエラー分類/47件/CSRF fixture、O22の32byte/43文字/100件/15件/mock区分を読み合わせた。英文は要約にせず全節を対応させた。

Humanizer v2.9.1の[編集計画](humanizer-edits.json)と[監査](humanizer-audit.json)に12ファイルの前後hashと意味の確認を保存。定型的な答えの予告、過剰な対比、抽象的な締めを修正。frontmatter、コードフェンス、URL、数字は不変。最終hashも一致。

## 最終検証

- `npx zenn list:articles`成功。[一覧](zenn-list.txt)に6件あり。
- `node scripts/validate-article-stock.mjs --batch=5`成功。[6組の結果](content-validation.json)。GDScriptも日英コード一致の対象へ追加。
- `node scripts/validate-article-stock.mjs`成功。[完成対象29組](complete-validation.json)。canonical例外なし。
- [repository-guard.json](repository-guard.json): baseline8a1bfa8の保護対象130ファイル、batch4までの177記事ファイルがbyte同一。Humanizer12最終hash一致。
- `git diff --check`とstage後の`git diff --cached --check`を実施。
- 日英ともpublished:false。予約表、公開workflow、既存記事の本文・公開フラグ・IDは変更なし。
