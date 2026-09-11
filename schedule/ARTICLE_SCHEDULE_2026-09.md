# 90日分の記事公開予定

2026-09-12〜2026-12-10、毎日09:00（Asia/Tokyo）を基準に、日本語1本とdev.to英語版1本を公開する。合計90組・180本。日本語の内訳はZenn41本、Qiita49本。GitHub Actionsの開始遅延により、公開が予定時刻より遅れる場合がある。

9月12日の追加指示で開始を今日へ1日前倒しした。初日の1組は手動で直ちに公開し、翌日以降は09:00を基準に実行する。

先に書きたい12本を優先順に配置し、残りは制作バッチ順・同バッチ内は候補表順。9月12日のユーザー指示で予約を追加した。既存の38日分の記録は保持している。

予約の正本は[publishing-schedule.json](publishing-schedule.json)。[公開workflow](../.github/workflows/publish-scheduled.yml)はdefault branchの予約表を読み、[投稿処理](../scripts/publish-scheduled.mjs)で当日の1組を扱う。登録時点では全180原稿の公開フラグを下書きのままにしている。

Qiita向け49組のcanonicalは公開前にはnull。日本語版を作成した応答のURLを、同日の英語版に設定してから公開する。Qiitaの公開が失敗した場合は英語版へ進まない。Zenn向け41組はslugから確定する日本語URLを使う。

当日公開は「Publish scheduled article」の実行結果で確認する。失敗日の再実行は対象日を指定し、dry_runをfalseにする。trueなら記事を選ぶだけで公開しない。ZennはGitへの公開フラグ反映後に連携先が同期するため、日英ページの公開が厳密に同時とは限らない。

| 日 | 公開予定日（JST） | ID | 日本語媒体 | 日本語 | dev.to英語版 |
| --- | --- | --- | --- | --- | --- |
| 1 | 2026-09-12 | P01 | Zenn | [個人開発のPlane Projectを、作業ディレクトリではなくプロダクトで分ける](../articles/plane-project-boundaries.md) | [English](../devto/plane-project-boundaries.md) |
| 2 | 2026-09-13 | O01 | Zenn | [38日分のQiita・Zenn・dev.to投稿記録を監査する。予約と公開済みを分けて数える](../articles/publishing-38-day-audit.md) | [English](../devto/publishing-38-day-audit.md) |
| 3 | 2026-09-14 | T28 | Zenn | [Push Tokenはユーザー単位では足りない。登録と解除を端末単位にする設計](../articles/expo-push-token-device-ownership.md) | [English](../devto/expo-push-token-device-ownership.md) |
| 4 | 2026-09-15 | T31 | Qiita | [AndroidのSafe Areaがずれたら、Insetsを適用しているコンポーネントから調べる](../public/android-edge-to-edge-insets.md) | [English](../devto/android-edge-to-edge-insets.md) |
| 5 | 2026-09-16 | T37 | Qiita | [D1の複合インデックスを逆順にすると何が変わるか、検索計画で比べた](../public/d1-composite-index-column-order.md) | [English](../devto/d1-composite-index-column-order.md) |
| 6 | 2026-09-17 | O05 | Zenn | [Codexとの判断をリポジトリへ残す。決定ログを実装と検証から読み直す方法](../articles/repository-decision-log-evidence.md) | [English](../devto/repository-decision-log-evidence.md) |
| 7 | 2026-09-18 | P03 | Zenn | [PlaneのProject・Module・Cycle・Initiativeを、完了させたいものから選ぶ](../articles/plane-project-module-cycle-initiative.md) | [English](../devto/plane-project-module-cycle-initiative.md) |
| 8 | 2026-09-19 | T20 | Zenn | [Next.jsのServer ActionsとRoute Handlersは、呼び出し元との約束から選ぶ](../articles/nextjs-actions-route-handlers-boundary.md) | [English](../devto/nextjs-actions-route-handlers-boundary.md) |
| 9 | 2026-09-20 | T01 | Qiita | [Promise.all・allSettled・any・raceを、失敗が先に来る同じ入力で比べる](../public/promise-combinators-partial-failure.md) | [English](../devto/promise-combinators-partial-failure.md) |
| 10 | 2026-09-21 | O07 | Zenn | [AIが書いたコードを「動いた」で終わらせない。条件を一つ壊してテストを読む](../articles/ai-code-review-invariants.md) | [English](../devto/ai-code-review-invariants.md) |
| 11 | 2026-09-22 | O10 | Zenn | [Game Jamのリポジトリを次回も使う。イベントの境界と書き出し先を固定する](../articles/game-jam-repository-reuse.md) | [English](../devto/game-jam-repository-reuse.md) |
| 12 | 2026-09-23 | O03 | Zenn | [予約投稿の再実行で重複を防げる範囲。保存済みIDと応答消失を分けて検証する](../articles/scheduled-publishing-recovery-boundary.md) | [English](../devto/scheduled-publishing-recovery-boundary.md) |
| 13 | 2026-09-24 | P02 | Zenn | [PlaneはWorkspaceとProjectのどちらで分けるか。管理者に見せる範囲から決める](../articles/plane-workspace-access-boundaries.md) | [English](../devto/plane-workspace-access-boundaries.md) |
| 14 | 2026-09-25 | T36 | Zenn | [D1のbatchで更新0件は失敗にならない。ロールバックされる条件を実験する](../articles/d1-batch-atomicity-boundary.md) | [English](../devto/d1-batch-atomicity-boundary.md) |
| 15 | 2026-09-26 | P14 | Zenn | [Plane PagesとWork Itemsのどちらに仕様を書くか](../articles/plane-pages-work-item-boundary.md) | [English](../devto/plane-pages-work-item-boundary.md) |
| 16 | 2026-09-27 | P15 | Zenn | [GitHub IssueとPlaneを二重管理しないための境界](../articles/plane-github-issue-boundary.md) | [English](../devto/plane-github-issue-boundary.md) |
| 17 | 2026-09-28 | O09 | Zenn | [AIチャットから制作記を書く前に、数字と完了状態を一次資料で確かめる](../articles/devlog-primary-source-reconstruction.md) | [English](../devto/devlog-primary-source-reconstruction.md) |
| 18 | 2026-09-29 | O12 | Zenn | [itch.io提出前に揃えるゲーム外の成果物。説明文と画像の実体を確認する](../articles/itch-submission-deliverables.md) | [English](../devto/itch-submission-deliverables.md) |
| 19 | 2026-09-30 | O17 | Zenn | [AI生成素材の出典、原本、採否をどう残したか](../articles/generated-asset-provenance-decisions.md) | [English](../devto/generated-asset-provenance-decisions.md) |
| 20 | 2026-10-01 | O18 | Zenn | [ローカル画像生成を再現可能にするため、モデル本体以外に何を保存するか](../articles/local-image-generation-reproducibility.md) | [English](../devto/local-image-generation-reproducibility.md) |
| 21 | 2026-10-02 | T09 | Zenn | [ESMとCommonJSが混ざったら、Node.jsの判定と読み込み方法を分けて調べる](../articles/node-esm-commonjs-boundaries.md) | [English](../devto/node-esm-commonjs-boundaries.md) |
| 22 | 2026-10-03 | T39 | Zenn | [D1の深いOFFSETをカーソルへ変える。読取り行数と途中挿入を比較する](../articles/d1-offset-cursor-pagination.md) | [English](../devto/d1-offset-cursor-pagination.md) |
| 23 | 2026-10-04 | T40 | Zenn | [Durable Objectsへデータを分ける前に、D1の横断クエリを棚卸しする](../articles/durable-objects-d1-coordination.md) | [English](../devto/durable-objects-d1-coordination.md) |
| 24 | 2026-10-05 | T42 | Zenn | [Cron Triggers・Queues・Workflowsを、失敗した後にどこから再開するかで選ぶ](../articles/cloudflare-cron-queues-workflows.md) | [English](../devto/cloudflare-cron-queues-workflows.md) |
| 25 | 2026-10-06 | T44 | Zenn | [Idempotency Keyを付けるだけでは二重処理を防げない。結果の保存まで検証する](../articles/idempotency-key-result-storage.md) | [English](../devto/idempotency-key-result-storage.md) |
| 26 | 2026-10-07 | T45 | Zenn | [OutboxでDB更新と通知をつなぐ。通知の意図が残ることと重複しないことを分ける](../articles/outbox-database-notification-boundary.md) | [English](../devto/outbox-database-notification-boundary.md) |
| 27 | 2026-10-08 | O13 | Zenn | [マウス・タッチ・ゲームパッドの入力を、画面と一押しの単位で揃える](../articles/game-input-support-sequence.md) | [English](../devto/game-input-support-sequence.md) |
| 28 | 2026-10-09 | O15 | Zenn | [ゲームBGMの採用記録を、曲数・割当先・実ファイルで照合する](../articles/game-bgm-selection-log.md) | [English](../devto/game-bgm-selection-log.md) |
| 29 | 2026-10-10 | O16 | Zenn | [63秒から60秒へ。ゲームトレイラーの尺をコードと動画で照合する](../articles/trailer-timeline-before-editing.md) | [English](../devto/trailer-timeline-before-editing.md) |
| 30 | 2026-10-11 | O20 | Zenn | [複数端末Pushの移行は、旧版のログアウトが残る間は終わらない](../articles/expo-multi-device-push-rollout.md) | [English](../devto/expo-multi-device-push-rollout.md) |
| 31 | 2026-10-12 | O21 | Zenn | [認証エラーのConfigurationを原因と決めつけず、復旧を確認する](../articles/auth-incident-recovery-evidence.md) | [English](../devto/auth-incident-recovery-evidence.md) |
| 32 | 2026-10-13 | O22 | Zenn | [ゲスト回答をアカウントへ引き継ぐ。名前ではなく回答の操作権を渡す](../articles/guest-identity-without-placeholder-user.md) | [English](../devto/guest-identity-without-placeholder-user.md) |
| 33 | 2026-10-14 | P08 | Zenn | [週末に終わらなかった作業を、CycleとリリースModuleでどう扱うか](../articles/plane-cycle-release-module.md) | [English](../devto/plane-cycle-release-module.md) |
| 34 | 2026-10-15 | P10 | Zenn | [個人開発のInitiativeは、全プロダクトを入れる前に共通の完了条件を決める](../articles/plane-initiative-personal-products.md) | [English](../devto/plane-initiative-personal-products.md) |
| 35 | 2026-10-16 | P17 | Zenn | [CodexチャットのTODOをPlaneへ集約するとき、同じテーマを重複扱いしない](../articles/plane-codex-todo-consolidation.md) | [English](../devto/plane-codex-todo-consolidation.md) |
| 36 | 2026-10-17 | P19 | Zenn | [一人開発のEstimateは、残り日数より抱えている作業の偏りに使う](../articles/plane-estimate-capacity-experiment.md) | [English](../devto/plane-estimate-capacity-experiment.md) |
| 37 | 2026-10-18 | T14 | Zenn | [useMemo・useCallbackで速くなる条件を、再計算の回数から確かめる](../articles/react-memoization-cost.md) | [English](../devto/react-memoization-cost.md) |
| 38 | 2026-10-19 | O19 | Zenn | [2サービスの保守を、Web・OTA・ネイティブの配布経路で棚卸しする](../articles/solo-web-ios-maintenance-scope.md) | [English](../devto/solo-web-ios-maintenance-scope.md) |
| 39 | 2026-10-20 | P20 | Zenn | [Plane Cloudとセルフホストを、復元時に引き受ける作業から比べる](../articles/plane-cloud-self-host-comparison.md) | [English](../devto/plane-cloud-self-host-comparison.md) |
| 40 | 2026-10-21 | T18 | Zenn | [Suspenseの境界を狭めると何が残るか。初回表示と再取得を5条件で比べる](../articles/suspense-boundary-fallback-experiment.md) | [English](../devto/suspense-boundary-fallback-experiment.md) |
| 41 | 2026-10-22 | T19 | Zenn | [Client境界を増やすとbundleは増えるか。境界1か所と2か所を実際に比べる](../articles/rsc-client-boundary-bundle.md) | [English](../devto/rsc-client-boundary-bundle.md) |
| 42 | 2026-10-23 | T21 | Zenn | [Next.js 16のキャッシュを、レスポンスと取得回数で見分ける](../articles/nextjs-cache-response-experiment.md) | [English](../devto/nextjs-cache-response-experiment.md) |
| 43 | 2026-10-24 | T34 | Zenn | [EAS Updateのerror recoveryは何を戻すか。iOSの復旧処理を7条件で確認する](../articles/eas-update-error-recovery-boundary.md) | [English](../devto/eas-update-error-recovery-boundary.md) |
| 44 | 2026-10-25 | O25 | Zenn | [VOLT NOMADのLT資料を5分へ絞る。制作工程より、残す判断を先に決める](../articles/five-minute-game-development-talk.md) | [English](../devto/five-minute-game-development-talk.md) |
| 45 | 2026-10-26 | T02 | Qiita | [TypeScriptのsatisfies・型注釈・asを、推論結果と欠落チェックで比べる](../public/typescript-satisfies-annotation-assertion.md) | [English](../devto/typescript-satisfies-annotation-assertion.md) |
| 46 | 2026-10-27 | T04 | Qiita | [typeとinterfaceは、宣言の追加と競合時のエラーで使い分ける](../public/type-interface-declaration-merging.md) | [English](../devto/type-interface-declaration-merging.md) |
| 47 | 2026-10-28 | T05 | Qiita | [enumをliteral unionへ変える前に、生成されるJavaScriptを確認する](../public/literal-union-enum-output.md) | [English](../devto/literal-union-enum-output.md) |
| 48 | 2026-10-29 | T06 | Qiita | [import typeを省くと何が残るか。tscとesbuildで副作用まで比較する](../public/import-type-bundler-output.md) | [English](../devto/import-type-bundler-output.md) |
| 49 | 2026-10-30 | T07 | Qiita | [structuredCloneとJSON往復コピーを、値と参照の壊れ方で比べる](../public/structured-clone-json-data.md) | [English](../devto/structured-clone-json-data.md) |
| 50 | 2026-10-31 | T08 | Qiita | [AbortControllerでタイマーを止める。開始前・待機中・完了後の7条件を確認する](../public/abortcontroller-cancellable-tasks.md) | [English](../devto/abortcontroller-cancellable-tasks.md) |
| 51 | 2026-11-01 | T11 | Qiita | [Reactのkeyをindexにすると入力欄はどうずれるか。値の持ち主を分けて再現する](../public/react-index-key-input-reorder.md) | [English](../devto/react-index-key-input-reorder.md) |
| 52 | 2026-11-02 | T12 | Qiita | [Strict ModeでEffectが二度動く条件を、購読のsetupとcleanupで確認する](../public/strict-mode-effect-cleanup.md) | [English](../devto/strict-mode-effect-cleanup.md) |
| 53 | 2026-11-03 | T13 | Qiita | [controlled inputの再実行はstateの置き場所で変わる。10・100・500項目で比較する](../public/controlled-uncontrolled-form-experiment.md) | [English](../devto/controlled-uncontrolled-form-experiment.md) |
| 54 | 2026-11-04 | T15 | Qiita | [useSyncExternalStoreで通知だけでは更新されない理由と、SSRの初期snapshotを確認する](../public/use-sync-external-store-ssr.md) | [English](../devto/use-sync-external-store-ssr.md) |
| 55 | 2026-11-05 | T16 | Qiita | [Reactのcallback refが返すcleanupを、同じDOMの再描画と型検査で確かめる](../public/react-callback-ref-cleanup.md) | [English](../devto/react-callback-ref-cleanup.md) |
| 56 | 2026-11-06 | T17 | Qiita | [useActionStateは入力値も残してくれるか。通常のフォームstateと9条件で比較する](../public/use-action-state-form-experiment.md) | [English](../devto/use-action-state-form-experiment.md) |
| 57 | 2026-11-07 | T10 | Qiita | [JavaScriptのusingは、returnや例外の後で何を解放するか。9条件で確認する](../public/using-resource-disposal.md) | [English](../devto/using-resource-disposal.md) |
| 58 | 2026-11-08 | T22 | Qiita | [Next.jsのMiddlewareをProxyへ移す。名前の変換後にmatcherとruntimeを確認する](../public/nextjs-middleware-proxy-migration.md) | [English](../devto/nextjs-middleware-proxy-migration.md) |
| 59 | 2026-11-09 | T23 | Qiita | [Next.jsのEdgeとNode.jsを同じ処理で比べる。build成功と実行成功は分けて確認する](../public/nextjs-edge-node-runtime.md) | [English](../devto/nextjs-edge-node-runtime.md) |
| 60 | 2026-11-10 | T24 | Qiita | [NEXT_PUBLICは起動時に変わるか。同じNext.js buildを別の環境変数で動かして確認する](../public/next-public-build-runtime-env.md) | [English](../devto/next-public-build-runtime-env.md) |
| 61 | 2026-11-11 | T25 | Qiita | [Next.jsのImageはどの画像を取得するか。src・srcset・currentSrcを実ブラウザーで比べる](../public/next-image-html-network.md) | [English](../devto/next-image-html-network.md) |
| 62 | 2026-11-12 | T38 | Qiita | [SQLiteの外部キーだけでは子のindexはできない。親削除の検索計画で確認する](../public/sqlite-foreign-key-child-index.md) | [English](../devto/sqlite-foreign-key-child-index.md) |
| 63 | 2026-11-13 | P05 | Qiita | [Planeのラベルを足す前に、状態と優先度で探せる作業を数える](../public/plane-label-taxonomy.md) | [English](../devto/plane-label-taxonomy.md) |
| 64 | 2026-11-14 | P06 | Qiita | [Planeの横断Viewが0件でも、今日の作業がないとは限らない](../public/plane-today-cross-project-view.md) | [English](../devto/plane-today-cross-project-view.md) |
| 65 | 2026-11-15 | P07 | Qiita | [PlaneのPQLは括弧で結果が変わる。121件と150件を状態別に照合する](../public/plane-pql-personal-dashboard.md) | [English](../devto/plane-pql-personal-dashboard.md) |
| 66 | 2026-11-16 | P11 | Qiita | [Planeの定期作業は、次回の起票と前回の未完了を分けて管理する](../public/plane-recurring-maintenance.md) | [English](../devto/plane-recurring-maintenance.md) |
| 67 | 2026-11-17 | P12 | Qiita | [PlaneのIntakeを使う前に、受け入れ判断と作業の状態を分ける](../public/plane-intake-before-backlog.md) | [English](../devto/plane-intake-before-backlog.md) |
| 68 | 2026-11-18 | P13 | Qiita | [PlaneのProject Templateには、固定する設定と毎回確認する値を分けて入れる](../public/plane-project-template.md) | [English](../devto/plane-project-template.md) |
| 69 | 2026-11-19 | O02 | Qiita | [日英記事のcanonical URLは、原稿作成時と投稿応答後で確定方法が違う](../public/bilingual-canonical-url-lifecycle.md) | [English](../devto/bilingual-canonical-url-lifecycle.md) |
| 70 | 2026-11-20 | O04 | Qiita | [記事ストックは何日分あるか。日英の組と媒体別の公開枠から数える](../public/article-stock-coverage-days.md) | [English](../devto/article-stock-coverage-days.md) |
| 71 | 2026-11-21 | O06 | Qiita | [GitHubの誤アカウントpushを防ぐ前提確認。hookの拒否と確認失敗を分ける](../public/personal-company-github-identity-guard.md) | [English](../devto/personal-company-github-identity-guard.md) |
| 72 | 2026-11-22 | O08 | Qiita | [Codexの長い作業を再開するとき、進捗件数を根拠ファイルから組み直す](../public/long-task-repository-handoff.md) | [English](../devto/long-task-repository-handoff.md) |
| 73 | 2026-11-23 | O11 | Qiita | [ゲームの旧試作をarchiveへ移す。コードの保存と現在の起動対象を別々に確認する](../public/game-prototype-archive-decisions.md) | [English](../devto/game-prototype-archive-decisions.md) |
| 74 | 2026-11-24 | O14 | Qiita | [日英33イベントの確認表を再生成する。イベント数が合っても会話は抜ける](../public/bilingual-story-archive-qa.md) | [English](../devto/bilingual-story-archive-qa.md) |
| 75 | 2026-11-25 | P04 | Qiita | [Planeの「確認待ち」をどのグループへ置くか。3プロジェクトの状態を点検する](../public/plane-status-by-deliverable.md) | [English](../devto/plane-status-by-deliverable.md) |
| 76 | 2026-11-26 | P09 | Qiita | [PlaneのModuleをバージョン単位にする前に、配布物の識別情報を分けておく](../public/plane-version-module.md) | [English](../devto/plane-version-module.md) |
| 77 | 2026-11-27 | P16 | Qiita | [Codexへ渡すPlaneの本文には、完了条件と確認結果を別々に残す](../public/plane-work-item-acceptance-evidence.md) | [English](../devto/plane-work-item-acceptance-evidence.md) |
| 78 | 2026-11-28 | P18 | Qiita | [Planeで個人開発を止めるとき、CancelledとArchiveに何を残すか](../public/plane-close-paused-project.md) | [English](../devto/plane-close-paused-project.md) |
| 79 | 2026-11-29 | O23 | Qiita | [日程の貼り付け取込を再実行すると何が起きるか。実コードで境界を調べる](../public/repeatable-schedule-import.md) | [English](../devto/repeatable-schedule-import.md) |
| 80 | 2026-11-30 | O24 | Qiita | [Web Audioで画面を音に反応させる。RMSと周波数ビンを実コードで確かめる](../public/web-audio-reactive-dashboard.md) | [English](../devto/web-audio-reactive-dashboard.md) |
| 81 | 2026-12-01 | T03 | Qiita | [unknownを付けるだけではAPI応答を検証できない。anyと型アサーションを比較する](../public/unknown-api-runtime-validation.md) | [English](../devto/unknown-api-runtime-validation.md) |
| 82 | 2026-12-02 | T26 | Qiita | [Expo SecureStoreとAsyncStorageを、秘密情報と復旧方法から使い分ける](../public/expo-securestore-asyncstorage-boundary.md) | [English](../devto/expo-securestore-asyncstorage-boundary.md) |
| 83 | 2026-12-03 | T27 | Qiita | [Expo Push Token・FCM Token・APNs Tokenは、送信先のAPIから区別する](../public/expo-fcm-apns-token-routing.md) | [English](../devto/expo-fcm-apns-token-routing.md) |
| 84 | 2026-12-04 | T30 | Qiita | [Universal LinksのAASAは200だけでは足りない。開発版のappIDとパスを照合する](../public/universal-links-aasa-diagnostics.md) | [English](../devto/universal-links-aasa-diagnostics.md) |
| 85 | 2026-12-05 | T33 | Qiita | [EAS Build・Submit・Updateの違いを、成功後にできるものから確認する](../public/eas-build-submit-update-artifacts.md) | [English](../devto/eas-build-submit-update-artifacts.md) |
| 86 | 2026-12-06 | T29 | Qiita | [Expo Routerの初期URLとurlイベントを、同じ到着待ちとして扱わない](../public/expo-router-initial-url-timing.md) | [English](../devto/expo-router-initial-url-timing.md) |
| 87 | 2026-12-07 | T32 | Qiita | [AppStateのinactiveとbackgroundを、同じ復帰イベントとして扱わない](../public/expo-appstate-platform-events.md) | [English](../devto/expo-appstate-platform-events.md) |
| 88 | 2026-12-08 | T35 | Qiita | [SplashScreenを閉じる条件を、フォント読み込みから画面の準備完了へ広げる](../public/expo-splash-screen-startup-race.md) | [English](../devto/expo-splash-screen-startup-race.md) |
| 89 | 2026-12-09 | T41 | Qiita | [WorkersのwaitUntilで202を返した後、失敗と完了はどこで確認するか](../public/workers-waituntil-failure-lifetime.md) | [English](../devto/workers-waituntil-failure-lifetime.md) |
| 90 | 2026-12-10 | T43 | Qiita | [Workersのキャッシュを消しても応答が変わらない。ブラウザ側の保存と分けて確認する](../public/cloudflare-cache-api-browser-cache.md) | [English](../devto/cloudflare-cache-api-browser-cache.md) |
