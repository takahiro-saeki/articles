# 日本語・英語記事の予約公開

- 機能ID: scheduled-publishing
- 対象: 個人リポジトリ takahiro-saeki/articles
- 最終確認日: 2026-10-09
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
- 配信: 予約workflowはactive。10/8のQiita公開と既存英語版canonical更新をworkflowの公開API照合とログアウト状態のブラウザで確認済み。将来のZenn公開は未実行。
- Webアプリ画面・iOS・Android・Cloudflare構成: 対象外。
- 検証結果・実公開URL: [移行記録](../../../production/2026-09/scheduling/weekly-zenn/README.md)。

### 2026-10-09の公開確認

T40「Durable Objectsへデータを分ける前に、D1の横断クエリを棚卸しする」は、[Qiita](https://qiita.com/hiro123/items/31e50190423c94e787f6)で12:18:54 JSTに公開された。09:00目標から3時間18分54秒遅れた。[既存英語版](https://dev.to/hirodeath/inventory-cross-room-queries-before-moving-d1-data-into-durable-objects-3oh3)はID `4794156`、10/4の初回公開日時を維持し、10/9 12:18:56 JSTにcanonicalを上記Qiita URLへ更新した。英語の新規投稿ではない。

[公開run 37878689199](https://github.com/takahiro-saeki/articles/actions/runs/37878689199)と[再確認run 37891443141](https://github.com/takahiro-saeki/articles/actions/runs/37891443141)はいずれも成功。18:35 JSTの点検で、main `e10d90c`の日英原稿と公開APIの本文・タイトル・著者が一致し、認証なし実ページがHTTP 200であること、英語canonicalの一致を再確認した。10/8のT09も再照合済み。詳細は[点検記録](../../../production/2026-09/scheduling/publication-check-2026-10-09.json)に保存した。

[ART-2](https://app.plane.so/hiro-work/browse/ART-2/)をDoneにし、ART-1と運用Wikiへ根拠を反映した。10/8以降の本日までの対象2組に未完了はない。点検からの追加dispatch・再投稿は行っていない。日本語の残りは66本（Zenn9・Qiita57）。T44/T45は10/10・10/11の予定を維持し、先行公開しない。
