# 日本語・英語記事の予約公開

- 機能ID: scheduled-publishing
- 対象: 個人リポジトリ takahiro-saeki/articles
- 最終確認日: 2026-10-28
- 比較基準: main c393e18960b3712b655e01a646aea44aafeb2efb
- 変更ブランチ: codex/weekly-zenn-qiita
- Plane: [articles (ART)](https://app.plane.so/hiro-work/projects/d4c06eb2-dcab-4871-a8ff-53e3a5427398/issues/)。2026-10-08のユーザー依頼でhiro-workに作成。[運用Wiki](https://app.plane.so/hiro-work/projects/d4c06eb2-dcab-4871-a8ff-53e3a5427398/pages/3dbae505-c466-448f-9122-8611396127b4)へ同期・読み戻し確認済み。

## 現在の設定

10/17から毎週土曜1本をZenn、それ以外の日をQiitaにする。日本語1本/日、09:00 JSTが目標。10/8の変更時点の残り68本をZenn9本・Qiita59本として12/14まで配置した。Zenn未公開4本を10/8〜10/11にQiitaで回復し、既存のdev.to IDを使ってcanonicalを更新する。

予約表は `schedule/publishing-schedule.json`、頻度・アカウントは `schedule/publishing-policy.json`。本文と翻訳の180ファイルは移行前と同一で、13本の日本語frontmatterと配置をQiita形式へ変えた。以前公開された日本語記事は移動しない。

## 実行と完了判定

1. default branchのGitHub Actionsが当日の1組を選択する。手動日付指定は将来の公開を拒否し、dry-runではAPI呼出し・ファイル書換えをしない。
2. Zennは土曜・初回10/17以降・同日未公開・前回実公開から24時間以上を確認してpublished:trueを準備し、先にGitへpushする。週1本は予約日の7日間隔と土曜限定で守る。24時間は追加の制限であり、Zennが公表する具体的な上限件数を意味しない。
3. Zennの認証なし公開ページのstatus、title、path、publishedAtを確認する。403や下書きプレビューは成功としない。Qiitaは日本語を作成し、IDを保存してから公開APIの本文・タイトル・private:falseと公開ページを照合する。
4. 日本語を確認した後、英語を公開する。既存IDがあればGETで本文・タイトル・canonicalを照合し、違う場合はPUTで同じIDを更新する。新しい英語版だけPOSTする。
5. 英語の公開APIと実ページを確認し、`schedule/publication-state.json`へverifiedを記録する。frontmatterだけで成功扱いにしない。確認状態から制作進捗表と候補一覧の公開確認欄も再生成する。
6. 部分失敗時も受信済みIDと状態をGitへ保存する。日英のAPI成功が、Git保存まで原子的に保証されるわけではない。

## 失敗と再試行

通常のQiita同期workflowと予約投稿workflowは同じconcurrency groupで直列化し、同時のメタデータ保存を避ける。checkoutは起動イベントのSHAではなく実行開始時の最新ブランチを取得し、待機中に先行workflowが保存したメタデータを含める。

同じworkflow内で最大3回、30秒・60秒待って再試行する。失敗はActions上のfailureとなる。Zennの公開要求中に403/404が継続する場合はpublished:falseへ戻し、平日の他記事のpushで再び公開要求されることを防ぐ。解除前にもう一度実ページを読み、公開済みになっていれば非公開へ戻さない。通信障害や503など公開状態を確定できないときはフラグを変えず、未確認として失敗を残す。

失敗・未確認のZennが残る間は別の記事を開始しない。同じ日付の公開要求は次の土曜に手動再試行できる。公開済みの本文確認と英語の回復は曜日に依存しない。失敗により土曜の枠がずれた場合、後続の予約は再調整が必要で、自動で別記事へ飛ばさない。

API成功後に応答自体を失った場合はIDが保存できないため、再試行前に公開先を調べる必要がある。Git push失敗時にもrun logと保存済みメタデータを確認する。ZennのHTML構造変更やGitHubの予約遅延は失敗要因として残る。週1本でもZenn側の公開を保証するものではない。

## Planeと日次点検

全体の運用は [ART-1: 90本の日英記事を予定日どおり公開し、両言語の実公開を確認する](https://app.plane.so/hiro-work/browse/ART-1/) で管理する。10/8のT09公開後に残る67本（Zenn9・Qiita58）を、ART-2〜ART-68へ1組1チケットで登録した。各チケットの開始日・期日はGitの公開予定日と一致する。原稿は完成済みだが、公開チケットはTodo。日英の実公開URL、canonical、確認日時、Actions runを根拠に残した後でDoneにする。全体チケットは全90組の実公開を確認してから完了する。

個別のID・slug・期日とPlaneページの対応は [plane-tracking.json](plane-tracking.json) に保存する。予約の正本は引き続きGitで、Planeは運用の一覧と記録に使う。予定変更時は両方を更新する。ポイント管理はこのProjectで未設定のため、Work Pointsは新設しない。

このチャットの定期実行「記事公開の点検・回復」（automation ID: `automation`）を毎日09:30・13:30 JST、12/15の最終確認まで有効化した。GitHub Actionsによる公開とは別に、当日と期限超過の未完了記事を確認する。

- 実行中のrunがある場合は重複起動しない。
- 未開始・失敗時は公開先と既存IDを確認し、対象の予約日で既存workflowを1回再実行する。過去のQiita未公開や英語・canonicalだけの失敗も既存IDを使って回復する。
- 未来日の先行公開、土曜以外のZenn新規公開、週1本制限の解除はしない。回復できない場合は失敗と後続への影響を記録・通知する。
- 通常成功や変化なしでは通知せず、新たな未公開、回復、ユーザー対応が必要な事項、全90組の完了を通知する。

GitHub Actionsの予約実行には遅延があるため09:00は目標時刻である。追加した定期点検はローカル実行で、PCとCodexアプリの起動が必要（[公式の実行条件](https://learn.chatgpt.com/docs/automations?surface=app)）。投稿自体はGitHub Actionsで動く。定期点検は10/8の18:37・22:35 JST、10/9の18:35 JSTに実行と公開照合を確認した。設定上の点検時刻と実際の確認時刻は区別して記録する。

## 検証と配信（実施記録）

- 実装: main反映済み（初回2ecfa9a、結果反映2a88b12、待機ジョブのcheckout修正1827ba3）。再実行37710179409でメタデータ保存まで確認。
- 検証: publisherの12ケース、90組dry-run、180本文・タイトル不変、frontmatter・canonical・タグ数・コードフェンス・重複・予約日を照合。
- 配信: 予約workflowはactive。10/8のQiita公開と既存英語版canonical更新をworkflowの公開API照合とログアウト状態のブラウザで確認済み。週1回のZennは10/17・10/24の公開を確認し、次回は10/31。以後の予定分は未実行。
- Webアプリ画面・iOS・Android・Cloudflare構成: 対象外。
- 検証結果・実公開URL: [移行記録](../../../production/2026-09/scheduling/weekly-zenn/README.md)。

### 2026-10-09の公開確認

T40「Durable Objectsへデータを分ける前に、D1の横断クエリを棚卸しする」は、[Qiita](https://qiita.com/hiro123/items/31e50190423c94e787f6)で12:18:54 JSTに公開された。09:00目標から3時間18分54秒遅れた。[既存英語版](https://dev.to/hirodeath/inventory-cross-room-queries-before-moving-d1-data-into-durable-objects-3oh3)はID `4794156`、10/4の初回公開日時を維持し、10/9 12:18:56 JSTにcanonicalを上記Qiita URLへ更新した。英語の新規投稿ではない。

[公開run 37878689199](https://github.com/takahiro-saeki/articles/actions/runs/37878689199)と[再確認run 37891443141](https://github.com/takahiro-saeki/articles/actions/runs/37891443141)はいずれも成功。18:35 JSTの点検で、main `e10d90c`の日英原稿と公開APIの本文・タイトル・著者が一致し、認証なし実ページがHTTP 200であること、英語canonicalの一致を再確認した。10/8のT09も再照合済み。詳細は[点検記録](../../../production/2026-09/scheduling/publication-check-2026-10-09.json)に保存した。

[ART-2](https://app.plane.so/hiro-work/browse/ART-2/)をDoneにし、ART-1と運用Wikiへ根拠を反映した。10/8以降の本日までの対象2組に未完了はない。点検からの追加dispatch・再投稿は行っていない。日本語の残りは66本（Zenn9・Qiita57）。T44/T45は10/10・10/11の予定を維持し、先行公開しない。

### 2026-10-10の公開確認

T44「Idempotency Keyを付けるだけでは二重処理を防げない。結果の保存まで検証する」は、[Qiita](https://qiita.com/hiro123/items/b13669edaeffb9701f8e)で11:58:37 JSTに公開された。09:00目標から2時間58分37秒遅れた。[既存英語版](https://dev.to/hirodeath/an-idempotency-key-needs-stored-results-testing-retries-and-concurrent-requests-24bh)はID `4804226`、10/6 12:28:58 JSTの初回公開日時を維持し、10/10 11:58:38 JSTにcanonicalを上記Qiita URLへ更新した。英語の新規投稿ではない。

[公開run 38018903346](https://github.com/takahiro-saeki/articles/actions/runs/38018903346)と[再確認run 38028535933](https://github.com/takahiro-saeki/articles/actions/runs/38028535933)はいずれも成功。18:26 JSTの点検で、main `107dc06`の日英原稿と公開APIの本文・タイトル・著者、英語canonicalの一致を確認した。認証なし実ページはHTTP 200、タイトル一致。T09・T40も再照合し、10/8以降の本日までの3組に未完了なし。[点検記録](../../../production/2026-09/scheduling/publication-check-2026-10-10.json)に根拠を保存した。

[ART-3](https://app.plane.so/hiro-work/browse/ART-3/)をDoneにし、ART-1と運用Wikiへ反映した。点検からの追加dispatch・再投稿は行っていない。日本語の残りは65本（Zenn9・Qiita56）。T45は10/11、次回Zennは10/17の予定を維持する。

### 2026-10-11の公開確認

T45「OutboxでDB更新と通知をつなぐ。通知の意図が残ることと重複しないことを分ける」は、[Qiita](https://qiita.com/hiro123/items/cd87126560ea16564d84)で11:28:27 JSTに公開された。09:00目標から2時間28分27秒遅れた。[既存英語版](https://dev.to/hirodeath/an-outbox-preserves-notification-intent-delivery-deduplication-is-a-separate-boundary-510h)はID `4809644`、10/7 10:39:03 JSTの初回公開日時を維持し、10/11 11:28:29 JSTにcanonicalを上記Qiita URLへ更新した。英語の新規投稿ではない。

[公開run 38105255072](https://github.com/takahiro-saeki/articles/actions/runs/38105255072)と[再確認run 38115488476](https://github.com/takahiro-saeki/articles/actions/runs/38115488476)はいずれも成功。18:35 JSTの点検で、main `53213d2`の日英原稿と公開APIの本文・タイトル・著者、英語canonicalの一致を確認した。認証なし実ページはHTTP 200、タイトル一致。T09・T40・T44も再照合し、10/8以降、本日までの4組に未完了なし。[点検記録](../../../production/2026-09/scheduling/publication-check-2026-10-11.json)に根拠を保存した。

[ART-4](https://app.plane.so/hiro-work/browse/ART-4/)をDoneにし、ART-1と運用Wikiへ反映した。Zenn未公開4本のQiita回復と既存英語canonical更新はすべて完了。点検からの追加dispatch・再投稿は行っていない。日本語の残りは64本（Zenn9・Qiita55）。10/12から新しい日英1組の公開を予定し、次回Zennは10/17を維持する。全90組の公開は未完了のためART-1はIn Progressのままとする。

### 2026-10-12の公開確認

O13「マウス・タッチ・ゲームパッドの入力を、画面と一押しの単位で揃える」は、[Qiita](https://qiita.com/hiro123/items/863735a90e1085b3155d)で11:52:54 JSTに公開された。09:00目標から2時間52分54秒遅れた。[英語版](https://dev.to/hirodeath/define-one-input-action-per-screen-across-mouse-touch-and-gamepad-controls-2g4b)はID `4835448`、11:52:55 JSTに新規公開された。日本語の実公開後に公開し、canonicalは上記Qiita URLと一致する。

[公開run 38197525201](https://github.com/takahiro-saeki/articles/actions/runs/38197525201)と[再確認run 38209622051](https://github.com/takahiro-saeki/articles/actions/runs/38209622051)はいずれも成功。18:32 JSTの点検で、main `efccecc`の日英原稿と公開APIの本文・タイトル・著者、英語canonicalの一致を確認した。認証なしの両実ページはHTTP 200、タイトル一致。10/8以降、本日までの5組すべてを再照合し、未完了なし。[点検記録](../../../production/2026-09/scheduling/publication-check-2026-10-12.json)に根拠を保存した。

[ART-5](https://app.plane.so/hiro-work/browse/ART-5/)をDoneにし、ART-1と運用Wikiへ反映した。点検からの追加dispatch・再投稿は行っていない。日本語の残りは63本（Zenn9・Qiita54）。次は10/13 O15、次回Zennは10/17。全90組の公開は未完了のためART-1はIn Progressを維持する。

### 2026-10-13の公開確認

O15「ゲームBGMの採用記録を、曲数・割当先・実ファイルで照合する」は、[Qiita](https://qiita.com/hiro123/items/2b9c97494a40746ce603)で13:08:12 JSTに公開された。09:00目標から4時間8分12秒遅れた。[英語版](https://dev.to/hirodeath/audit-a-game-soundtrack-by-selection-records-playback-slots-and-actual-files-4cai)はID `4841327`、13:08:13 JSTに新規公開された。日本語の実公開後に公開し、canonicalは上記Qiita URLと一致する。

[公開run 38344983145](https://github.com/takahiro-saeki/articles/actions/runs/38344983145)と[再確認run 38358301896](https://github.com/takahiro-saeki/articles/actions/runs/38358301896)はいずれも成功。18:36 JSTの点検で、main `a5043ab`の日英原稿と公開APIの本文・タイトル・著者、英語canonicalの一致を確認した。認証なしの両実ページはHTTP 200、タイトル一致。10/8以降、本日までの6組すべてを再照合し、未完了なし。[点検記録](../../../production/2026-09/scheduling/publication-check-2026-10-13.json)に根拠を保存した。

[ART-6](https://app.plane.so/hiro-work/browse/ART-6/)をDoneにし、ART-1と運用Wikiへ反映した。点検からの追加dispatch・再投稿は行っていない。日本語の残りは62本（Zenn9・Qiita53）。次は10/14 O16、次回Zennは10/17。全90組の公開は未完了のためART-1はIn Progressを維持する。

### 2026-10-14の公開確認

O16「63秒から60秒へ。ゲームトレイラーの尺をコードと動画で照合する」は、[Qiita](https://qiita.com/hiro123/items/863a22e166413d0aae2e)で11:22:10 JSTに公開された。09:00目標から2時間22分10秒遅れた。[英語版](https://dev.to/hirodeath/from-63-seconds-to-60-checking-a-game-trailer-against-its-timeline-and-video-files-1b6h)はID `4847368`、11:22:13 JSTに新規公開された。日本語の実公開後に公開し、canonicalは上記Qiita URLと一致する。

[公開run 38500644364](https://github.com/takahiro-saeki/articles/actions/runs/38500644364)と[再確認run 38513168408](https://github.com/takahiro-saeki/articles/actions/runs/38513168408)はいずれも成功。18:26 JSTの点検で、main `3ffa209`の日英原稿と公開APIの本文・タイトル・著者、英語canonicalの一致を確認した。認証なしの両実ページはHTTP 200、タイトル一致。10/8以降、本日までの7組すべてを再照合し、未完了なし。[点検記録](../../../production/2026-09/scheduling/publication-check-2026-10-14.json)に根拠を保存した。

[ART-7](https://app.plane.so/hiro-work/browse/ART-7/)をDoneにし、ART-1と運用Wikiへ反映した。点検からの追加dispatch・再投稿は行っていない。日本語の残りは61本（Zenn9・Qiita52）。次は10/15 O21、次回Zennは10/17。全90組の公開は未完了のためART-1はIn Progressを維持する。

### 2026-10-15の公開確認

O21「認証エラーのConfigurationを原因と決めつけず、復旧を確認する」は、[Qiita](https://qiita.com/hiro123/items/99a09ee6ee5cf25e8f94)で11:03:04 JSTに公開された。09:00目標から2時間3分4秒遅れた。[英語版](https://dev.to/hirodeath/verify-authentication-recovery-before-treating-configuration-as-the-root-cause-553m)はID `4853518`、11:03:05 JSTに新規公開された。日本語の実公開後に公開し、canonicalは上記Qiita URLと一致する。

[公開run 38668921281](https://github.com/takahiro-saeki/articles/actions/runs/38668921281)と[再確認run 38681793375](https://github.com/takahiro-saeki/articles/actions/runs/38681793375)はいずれも成功。18:34 JSTの点検で、main `227355c`の日英原稿と公開APIの本文・タイトル・著者、英語canonicalの一致を確認した。認証なしの両実ページはHTTP 200、タイトル一致。10/8以降、本日までの8組すべてを再照合し、未完了なし。[点検記録](../../../production/2026-09/scheduling/publication-check-2026-10-15.json)に根拠を保存した。

[ART-8](https://app.plane.so/hiro-work/browse/ART-8/)をDoneにし、ART-1と運用Wikiへ反映した。点検からの追加dispatch・再投稿は行っていない。日本語の残りは60本（Zenn9・Qiita51）。次は10/16 P17、次回Zennは10/17。全90組の公開は未完了のためART-1はIn Progressを維持する。

### 2026-10-16の公開回復・確認

10:28 JST時点で本日分のrunは未開始、実行中runもなかった。保存済みIDがなく、Qiita・dev.toの公開一覧にも同一記事がないことを確認し、既存workflowを `date=2026-10-16`、`dry_run=false` で1回実行した。

P17「CodexチャットのTODOをPlaneへ集約するとき、同じテーマを重複扱いしない」は、[Qiita](https://qiita.com/hiro123/items/3a7028821f58605e86fe)で10:29:30 JSTに公開された。09:00目標から1時間29分30秒遅れた。[英語版](https://dev.to/hirodeath/consolidating-codex-todos-in-plane-without-merging-different-deliverables-18ca)はID `4859215`、10:29:31 JSTに新規公開された。日本語の実公開後に公開し、canonicalは上記Qiita URLと一致する。

[復旧run 38835383028](https://github.com/takahiro-saeki/articles/actions/runs/38835383028)は成功し、境界テスト12件も成功。ID・URL・verifiedをmain `96ef98a`へ保存した。10:30 JSTの点検で日英原稿と公開APIの本文・タイトル・著者、英語canonicalの一致を確認し、認証なしの両実ページはHTTP 200、タイトル一致。10/8以降、本日までの9組すべてを再照合し、未完了なし。[点検記録](../../../production/2026-09/scheduling/publication-check-2026-10-16.json)に根拠を保存した。

[ART-9](https://app.plane.so/hiro-work/browse/ART-9/)をDoneにし、ART-1と運用Wikiへ反映した。日本語の残りは59本（Zenn9・Qiita50）。次は10/17 O20、週1回のZenn初回。未来日の先行公開は行っていない。全90組の公開は未完了のためART-1はIn Progressを維持する。

### 2026-10-17の公開確認

週1回のZenn運用の初回O20「複数端末Pushの移行は、旧版のログアウトが残る間は終わらない」は、[Zenn](https://zenn.dev/hirodeath/articles/expo-multi-device-push-rollout)で10:47:59.955 JSTに公開された（ID `649873`）。09:00目標から1時間47分59.955秒遅れた。[英語版](https://dev.to/hirodeath/a-multi-device-push-rollout-remains-incomplete-while-old-logout-behavior-survives-3881)はID `4865168`、10:48:27.368 JSTに新規公開され、canonicalは上記Zenn URLと一致する。

[公開run 38992356619](https://github.com/takahiro-saeki/articles/actions/runs/38992356619)と[再確認run 39002039286](https://github.com/takahiro-saeki/articles/actions/runs/39002039286)はいずれも成功し、境界テスト12件も成功。20:08 JSTの点検で、main `71cbed8`とZennの認証なし実ページを照合し、HTTP 200・published・非プレビュー・タイトル・著者・path・公開日時・本文の表示テキスト・リンクの一致を確認した。

dev.to公開APIのローカル取得は404で、`X-Cache: HIT, HIT`、`Age: 36037`秒の応答だった。本人用APIでアカウント`hirodeath`と既存IDの`published:true`・本文Markdown・タイトル・著者・canonicalを確認した。認証なし実ページもHTTP 200で、全文の表示テキスト（コード表示ボタンと空白を除く）・canonical・公開日時が一致。両Actionsの公開API検証も成功しているため、公開済みと判定した。キャッシュされたAPI応答を理由に再投稿は行っていない。

10/8以降、本日までの10組・20実ページを確認し、未完了なし。[点検記録](../../../production/2026-09/scheduling/publication-check-2026-10-17.json)に根拠とAPIの例外を保存した。[ART-10](https://app.plane.so/hiro-work/browse/ART-10/)をDoneにし、ART-1・Project概要・運用Wikiへ反映した。追加dispatchはなし。日本語の残りは58本（Zenn8・Qiita50）。次は10/18 Qiita P19、次回Zennは10/24。全90組の公開は未完了のためART-1はIn Progressを維持する。

### 2026-10-18の公開確認

P19「一人開発のEstimateは、残り日数より抱えている作業の偏りに使う」は、[Qiita](https://qiita.com/hiro123/items/e7cf1e1dd800e839acc0)で10:45:41 JSTに公開された。09:00目標から1時間45分41秒遅れた。[英語版](https://dev.to/hirodeath/using-estimates-to-spot-overloaded-solo-projects-before-predicting-dates-3j62)はID `4869701`、10:45:42 JSTに新規公開され、canonicalは上記Qiita URLと一致する。

[公開run 39087639564](https://github.com/takahiro-saeki/articles/actions/runs/39087639564)と[再確認run 39096948528](https://github.com/takahiro-saeki/articles/actions/runs/39096948528)はいずれも成功し、境界テスト12件も成功。18:31 JSTの点検で、main `13a1759`の日英原稿と公開APIの本文・タイトル・著者を照合。認証なしの両実ページはHTTP 200、タイトル一致。日本語の実公開後に英語が公開されたことを確認した。

昨日O20のdev.to公開APIはキャッシュされた404（`X-Cache: HIT, HIT`、`Age: 116681`秒）が続くが、本人用APIでアカウント・既存ID・published:true・本文・タイトル・canonicalを照合し、認証なし実ページの全文とcanonicalも一致した。Zennの公開メタデータ・本文・リンクも再確認済み。本日P19の公開APIは正常で、昨日のAPI応答を根拠に再投稿はしていない。

10/8以降、本日までの11組・22実ページを確認し、未完了なし。[点検記録](../../../production/2026-09/scheduling/publication-check-2026-10-18.json)に根拠を保存した。[ART-11](https://app.plane.so/hiro-work/browse/ART-11/)をDoneにし、ART-1・運用Wikiへ反映した。追加dispatchはなし。日本語の残りは57本（Zenn8・Qiita49）。次は10/19 Qiita T14、次回Zennは10/24。全90組の公開は未完了のためART-1はIn Progressを維持する。

### 2026-10-19の公開確認

T14「useMemo・useCallbackで速くなる条件を、再計算の回数から確かめる」は、[Qiita](https://qiita.com/hiro123/items/2fda66bcf469a167e06b)で11:02:57 JSTに公開された。09:00目標から2時間2分57秒遅れた。[英語版](https://dev.to/hirodeath/when-usememo-and-usecallback-help-count-the-work-they-actually-skip-4hob)はID `4874778`、11:02:59 JSTに新規公開され、canonicalは上記Qiita URLと一致する。

[公開run 39188104155](https://github.com/takahiro-saeki/articles/actions/runs/39188104155)と[再確認run 39200001571](https://github.com/takahiro-saeki/articles/actions/runs/39200001571)はいずれも成功し、境界テスト12件も成功。18:36 JSTの点検で、main `170bb94`の日英原稿と公開APIの本文・タイトル・著者を照合。認証なしの両実ページはHTTP 200、タイトル一致。日本語の実公開後に英語が公開されたことを確認した。

10/17 O20のdev.to公開APIは今回HTTP 200となり、本文・タイトル・著者・既存ID・canonicalが一致した。前回までのキャッシュされた404は今回観測されていない。Zennの公開メタデータ・本文・リンクも再確認し、過去11組の保存済みIDと初回公開日時は維持されている。

10/8以降、本日までの12組・24実ページを確認し、未完了なし。[点検記録](../../../production/2026-09/scheduling/publication-check-2026-10-19.json)に根拠を保存した。[ART-12](https://app.plane.so/hiro-work/browse/ART-12/)をDoneにし、ART-1・運用Wikiへ反映した。追加dispatchはなし。日本語の残りは56本（Zenn8・Qiita48）。次は10/20 Qiita T18、次回Zennは10/24。全90組の公開は未完了のためART-1はIn Progressを維持する。

### 2026-10-20の公開確認

T18「Suspenseの境界を狭めると何が残るか。初回表示と再取得を5条件で比べる」は、[Qiita](https://qiita.com/hiro123/items/d0ed79eedc219863500c)で11:19:48 JSTに公開された。09:00目標から2時間19分48秒遅れた。[英語版](https://dev.to/hirodeath/what-stays-visible-when-a-suspense-boundary-moves-five-loading-cases-3fnp)はID `4880744`、11:19:49 JSTに新規公開され、canonicalは上記Qiita URLと一致する。

[公開run 39358302822](https://github.com/takahiro-saeki/articles/actions/runs/39358302822)と[再確認run 39370946168](https://github.com/takahiro-saeki/articles/actions/runs/39370946168)はいずれも成功し、境界テスト12件も成功。18:27 JSTの点検で、main `68dcb8e`の日英原稿と公開APIの本文・タイトル・著者を照合。認証なしの両実ページはHTTP 200、タイトル一致。日本語の実公開後に英語が公開されたことを確認した。

10/8以降、本日までの13組・26実ページを確認。Qiita12本と英語13本の公開APIで本文・タイトル・著者・canonicalが一致し、Zenn O20も公開メタデータ・本文・リンクを再確認した。過去12組の保存済みIDと初回公開日時は維持されている。

[点検記録](../../../production/2026-09/scheduling/publication-check-2026-10-20.json)に根拠を保存した。[ART-13](https://app.plane.so/hiro-work/browse/ART-13/)をDoneにし、ART-1・運用Wikiへ反映した。10/8以降、本日までの未完了なし。追加dispatchはなし。日本語の残りは55本（Zenn8・Qiita47）。次は10/21 Qiita O25、次回Zennは10/24。全90組の公開は未完了のためART-1はIn Progressを維持する。

### 2026-10-21の公開確認

O25「VOLT NOMADのLT資料を5分へ絞る。制作工程より、残す判断を先に決める」は、[Qiita](https://qiita.com/hiro123/items/5b9ce0d04a59f38f5efa)で11:12:52 JSTに公開された。09:00目標から2時間12分52秒遅れた。[英語版](https://dev.to/hirodeath/editing-a-volt-nomad-talk-to-five-minutes-allocate-time-to-decisions-4dn8)はID `4886381`、11:12:54 JSTに新規公開され、canonicalは上記Qiita URLと一致する。

[公開run 39531743948](https://github.com/takahiro-saeki/articles/actions/runs/39531743948)と[再確認run 39545082162](https://github.com/takahiro-saeki/articles/actions/runs/39545082162)はいずれも成功し、境界テスト12件も成功。18:31 JSTの点検で、main `58ed4c8`の日英原稿と公開APIの本文・タイトル・著者を照合。認証なしの両実ページはHTTP 200、タイトル一致。日本語の実公開後に英語が公開されたことを確認した。

10/8以降、本日までの14組・28実ページを確認。Qiita13本と英語14本の公開APIで本文・タイトル・著者・canonicalが一致し、Zenn O20も公開メタデータ・本文・リンクを再確認した。過去13組の保存済みIDと初回公開日時は維持されている。

[点検記録](../../../production/2026-09/scheduling/publication-check-2026-10-21.json)に根拠を保存した。[ART-14](https://app.plane.so/hiro-work/browse/ART-14/)をDoneにし、ART-1・運用Wikiへ反映した。10/8以降、本日までの未完了なし。追加dispatchはなし。日本語の残りは54本（Zenn8・Qiita46）。次は10/22 Qiita T02、次回Zennは10/24。全90組の公開は未完了のためART-1はIn Progressを維持する。

### 2026-10-22の公開確認

T02「TypeScriptのsatisfies・型注釈・asを、推論結果と欠落チェックで比べる」は、[Qiita](https://qiita.com/hiro123/items/df2b5c521387bc991b49)で11:07:13 JSTに公開された。09:00目標から2時間7分13秒遅れた。[英語版](https://dev.to/hirodeath/comparing-satisfies-type-annotations-and-assertions-through-compiler-output-4f50)はID `4892731`、11:07:14 JSTに新規公開され、canonicalは上記Qiita URLと一致する。

[公開run 39709589090](https://github.com/takahiro-saeki/articles/actions/runs/39709589090)と[再確認run 39723257006](https://github.com/takahiro-saeki/articles/actions/runs/39723257006)はいずれも成功し、境界テスト12件も成功。18:26 JSTの点検で、main `e513068`の日英原稿と公開APIの本文・タイトル・著者を照合。認証なしの両実ページはHTTP 200、タイトル一致。日本語の実公開後に英語が公開されたことを確認した。

10/8以降、本日までの15組・30実ページを確認。Qiita14本と英語15本の公開APIで本文・タイトル・著者・canonicalが一致し、Zenn O20も公開メタデータ・本文・リンクを再確認した。過去14組の保存済みIDと初回公開日時は維持されている。

[点検記録](../../../production/2026-09/scheduling/publication-check-2026-10-22.json)に根拠を保存した。[ART-15](https://app.plane.so/hiro-work/browse/ART-15/)をDoneにし、ART-1・運用Wikiへ反映した。10/8以降、本日までの未完了なし。追加dispatchはなし。日本語の残りは53本（Zenn8・Qiita45）。次は10/23 Qiita T04、次回Zennは10/24。全90組の公開は未完了のためART-1はIn Progressを維持する。

### 2026-10-23の公開確認

T04「typeとinterfaceは、宣言の追加と競合時のエラーで使い分ける」は、[Qiita](https://qiita.com/hiro123/items/816c214eb80036fbe359)で11:12:33 JSTに公開された。09:00目標から2時間12分33秒遅れた。[英語版](https://dev.to/hirodeath/choosing-type-or-interface-by-declaration-merging-and-conflict-diagnostics-2ob8)はID `4902233`、11:12:35 JSTに新規公開され、canonicalは上記Qiita URLと一致する。

[公開run 39888293383](https://github.com/takahiro-saeki/articles/actions/runs/39888293383)と[再確認run 39901626871](https://github.com/takahiro-saeki/articles/actions/runs/39901626871)はいずれも成功し、境界テスト12件も成功。18:31 JSTの点検で、main `54440c5`の日英原稿と公開APIの本文・タイトル・著者を照合。認証なしの両実ページはHTTP 200、タイトル一致。日本語の実公開後に英語が公開されたことを確認した。

10/8以降、本日までの16組・32実ページを確認。Qiita15本と英語16本の公開APIで本文・タイトル・著者・canonicalが一致し、Zenn O20も公開メタデータ・本文・リンクを再確認した。過去15組の保存済みIDと初回公開日時は維持されている。

[点検記録](../../../production/2026-09/scheduling/publication-check-2026-10-23.json)に根拠を保存した。[ART-16](https://app.plane.so/hiro-work/browse/ART-16/)をDoneにし、ART-1・運用Wikiへ反映した。10/8以降、本日までの未完了なし。追加dispatchはなし。日本語の残りは52本（Zenn8・Qiita44）。次は10/24（土）Zenn O22。全90組の公開は未完了のためART-1はIn Progressを維持する。

### 2026-10-24の公開確認

O22「ゲスト回答をアカウントへ引き継ぐ。名前ではなく回答の操作権を渡す」は、[Zenn](https://zenn.dev/hirodeath/articles/guest-identity-without-placeholder-user)で11:11:03.272 JSTに公開された（ID `649880`）。09:00目標から2時間11分3.272秒遅れた。[英語版](https://dev.to/hirodeath/claim-guest-responses-by-transferring-control-of-a-record-not-matching-a-name-k1e)はID `4908268`、11:11:29 JSTに公開された。日本語の実公開後に公開され、canonicalは上記Zenn URLと一致する。

[公開run 40053087392](https://github.com/takahiro-saeki/articles/actions/runs/40053087392)と[再確認run 40062526689](https://github.com/takahiro-saeki/articles/actions/runs/40062526689)はいずれも成功し、境界テスト12件と公開API検証も成功。18:28 JSTの点検ではmain `5fe34c9`を基準に10/8〜10/24の17組・34実ページを再確認した。認証なし実ページは全てHTTP 200・タイトル一致。Qiita15本・英語17本の公開APIで本文・タイトル・著者・canonicalが一致し、Zenn2本はpublished・非プレビュー・公開メタデータ・本文の表示テキスト・リンクが一致した。過去16組の保存済みIDと初回公開日時を維持し、未完了・期限超過なし。[点検記録](../../../production/2026-09/scheduling/publication-check-2026-10-24.json)に根拠を保存した。

追加dispatch・再投稿は行っていない。残り51組（日本語Zenn7・Qiita44と英語51）。次は10/25 Qiita T05、次回Zennは10/31。全90組の公開は未完了のためART-1はIn Progressを維持する。Plane MCPの接続問題は既報のまま継続している。ブラウザでhiro-workを確認してART-17をDoneへ更新し、ART-1と運用Wikiへ根拠・残数・次回予定を反映した。再読み込み後の本文と状態を確認済み。

### 2026-10-25の公開確認

T05「enumをliteral unionへ変える前に、生成されるJavaScriptを確認する」は、[Qiita](https://qiita.com/hiro123/items/dd7c31db2fa5a551396c)で10:57:21 JSTに公開された（ID `dd7c31db2fa5a551396c`）。09:00目標から1時間57分21秒遅れた。[英語版](https://dev.to/hirodeath/inspect-emitted-javascript-before-replacing-enums-with-literal-unions-12f6)はID `4912979`、10:57:23 JSTに公開され、canonicalは上記Qiita URLと一致する。日本語の実公開後に英語が公開されたことを確認した。

[公開run 40152596657](https://github.com/takahiro-saeki/articles/actions/runs/40152596657)と[再確認run 40162339795](https://github.com/takahiro-saeki/articles/actions/runs/40162339795)はいずれも成功し、境界テスト12件と公開API検証も成功。18:27 JSTの点検ではmain `9cf0ef4`を基準に10/8〜10/25の18組・36実ページを再照合した。認証なし実ページは全てHTTP 200・タイトル一致。Qiita16本・英語18本の公開APIで本文・タイトル・著者・canonicalが一致し、Zenn2本はpublished・非プレビュー・公開メタデータ・本文表示テキスト・リンクが一致した。過去17組の保存済みIDと初回公開日時を維持し、未完了・期限超過なし。[点検記録](../../../production/2026-09/scheduling/publication-check-2026-10-25.json)に根拠を保存した。

追加dispatch・再投稿は行っていない。残り50組（日本語Zenn7・Qiita43と英語50）。次は10/26 Qiita T06、次回Zennは10/31、最終予定は12/14。Plane MCPの接続問題は既報のまま継続している。ブラウザでhiro-workを確認し、ART-18をDoneへ更新、ART-1と運用Wikiへ根拠・残数・次回予定を反映した。再読み込み後の保存内容を確認済み。全90組の公開は未完了のためART-1はIn Progressを維持する。

### 2026-10-26の公開確認

T06「import typeを省くと何が残るか。tscとesbuildで副作用まで比較する」は、[Qiita](https://qiita.com/hiro123/items/943c447584e4a7f4c3ae)で10:58:58 JSTに公開された（ID `943c447584e4a7f4c3ae`）。09:00目標から1時間58分58秒遅れた。[英語版](https://dev.to/hirodeath/what-remains-without-import-type-comparing-tsc-esbuild-and-side-effects-3pmi)はID `4918311`、10:58:59 JSTに公開され、canonicalは上記Qiita URLと一致する。日本語の実公開後に英語が公開されたことを確認した。

[公開run 40256821074](https://github.com/takahiro-saeki/articles/actions/runs/40256821074)と[再確認run 40270129729](https://github.com/takahiro-saeki/articles/actions/runs/40270129729)はいずれも成功し、境界テスト12件と公開API検証も成功。18:33 JSTの点検ではmain `4382748`を基準に10/8〜10/26の19組・38実ページを再照合した。認証なし実ページは全てHTTP 200・タイトル一致。Qiita17本・英語19本の公開APIで本文・タイトル・著者・canonicalが一致し、Zenn2本はpublished・非プレビュー・公開メタデータ・本文表示テキスト・リンクが一致した。過去18組の保存済みIDと初回公開日時を維持し、未完了・期限超過なし。[点検記録](../../../production/2026-09/scheduling/publication-check-2026-10-26.json)に根拠を保存した。

追加dispatch・再投稿は行っていない。残り49組（日本語Zenn7・Qiita42と英語49）。次は10/27 Qiita T07、次回Zennは10/31、最終予定は12/14。Plane MCPの接続問題は既報のまま継続している。ブラウザでhiro-workを確認し、ART-19をDoneへ更新、ART-1と運用Wikiへ根拠・残数・次回予定を反映した。再読み込み後の保存内容を確認済み。全90組の公開は未完了のためART-1はIn Progressを維持する。

### 2026-10-27の公開確認

T07「structuredCloneとJSON往復コピーを、値と参照の壊れ方で比べる」は、[Qiita](https://qiita.com/hiro123/items/c571f84cad78f7f1919a)で11:36:55 JSTに公開された（ID `c571f84cad78f7f1919a`）。09:00目標から2時間36分55秒遅れた。[英語版](https://dev.to/hirodeath/comparing-structuredclone-and-json-copies-through-values-and-reference-identity-2noe)はID `4925161`、11:36:56 JSTに公開され、公開APIとHTMLのcanonicalは上記Qiita URLと一致する。日本語の実公開後に英語が公開されたことを確認した。

[公開run 40439441406](https://github.com/takahiro-saeki/articles/actions/runs/40439441406)と[再確認run 40452497788](https://github.com/takahiro-saeki/articles/actions/runs/40452497788)はいずれも成功し、境界テスト12件と公開API検証も成功。18:28 JSTの点検ではmain `4f2f75f`を基準に10/8〜10/27の20組・40実ページを再照合した。認証なし実ページは全てHTTP 200・タイトル一致。Qiita18本・英語20本の公開APIで本文・タイトル・著者・canonicalが一致し、Zenn2本はpublished・非プレビュー・公開メタデータ・本文表示テキスト・リンクが一致した。過去19組の保存済みIDと初回公開日時を維持し、未完了・期限超過なし。[点検記録](../../../production/2026-09/scheduling/publication-check-2026-10-27.json)に根拠を保存した。

追加dispatch・再投稿は行っていない。残り48組（日本語Zenn7・Qiita41と英語48）。次は10/28 Qiita T08、次回Zennは10/31、最終予定は12/14。Plane MCPがOAuth接続で利用可能になり、各書き込み前にhiro-workを確認して[ART-20](https://app.plane.so/hiro-work/browse/ART-20/)をDoneへ更新、ART-1と運用Wikiへ根拠・残数・次回予定を反映した。APIによる読み戻しで本文・リンク・状態と既存履歴の保持を確認し、10/23から継続していたMCP接続問題の復旧を確認した。全90組の公開は未完了のためART-1はIn Progressを維持する。

### 2026-10-28の公開確認

T08「AbortControllerでタイマーを止める。開始前・待機中・完了後の7条件を確認する」は、[Qiita](https://qiita.com/hiro123/items/fad56597209be02192ae)で11:45:40 JSTに公開された（ID `fad56597209be02192ae`）。09:00目標から2時間45分40秒遅れた。[英語版](https://dev.to/hirodeath/cancelling-timers-with-abortcontroller-seven-cases-including-cleanup-1g7c)はID `4931669`、11:45:42 JSTに公開され、公開APIとHTMLのcanonicalは上記Qiita URLと一致する。日本語の実公開後に英語が公開されたことを確認した。

[公開run 40622805866](https://github.com/takahiro-saeki/articles/actions/runs/40622805866)と[再確認run 40638504889](https://github.com/takahiro-saeki/articles/actions/runs/40638504889)はいずれも成功し、境界テスト12件と公開API検証も成功。18:34 JSTの点検ではmain `e3c48f1`を基準に10/8〜10/28の21組・42実ページを再照合した。認証なし実ページは全てHTTP 200・タイトル一致。Qiita19本・英語21本の公開APIで本文・タイトル・著者・canonicalが一致し、Zenn2本はpublished・非プレビュー・公開メタデータ・本文表示テキスト・リンクが一致した。過去20組の保存済みIDと初回公開日時を維持し、未完了・期限超過なし。[点検記録](../../../production/2026-09/scheduling/publication-check-2026-10-28.json)に根拠を保存した。

追加dispatch・再投稿は行っていない。残り47組（日本語Zenn7・Qiita40と英語47）。次は10/29 Qiita T11、次回Zennは10/31、最終予定は12/14。各書き込み前にPlaneのhiro-workを確認して[ART-21](https://app.plane.so/hiro-work/browse/ART-21/)をDoneへ更新し、ART-1と運用Wikiへ根拠・残数・次回予定を反映した。APIによる読み戻しで本文・リンク・状態と既存履歴の保持を確認済み。全90組の公開は未完了のためART-1はIn Progressを維持する。
