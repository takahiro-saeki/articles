---
title: "Push Tokenはユーザー単位では足りない。登録と解除を端末単位にする設計"
emoji: "📱"
type: "tech"
topics: ["expo", "reactnative", "database", "typescript"]
published: true
---

スマートフォンを二台使うユーザーに通知を届けるには、送信先を配列に変えるだけでは足りません。二台目を登録するときに一台目を消さず、ログアウトでも操作した端末だけを解除する必要があります。

SquadNoteの複数端末対応では、テーブルの追加よりも、登録と解除が扱う範囲の変更が中心でした。もともとPush Tokenは別テーブルにあり、トークン自体の一意制約も存在していました。変更したのは、その構造を一人複数端末として使うAPIとモバイル側の処理です。

この記事の対象は`circle-hub`のコミット`ad0a669`と、それを含む`0cda1e8`です。2026年9月11日に対象テストを再実行しました。実装とローカル検証の紹介であり、両OSへの配信完了や実機受信を報告する記事ではありません。

## ユーザーと送信先を別の行で表す

元のスキーマには`id`、`userId`、`token`、`platform`、`createdAt`があり、`userId`には検索用インデックス、`token`には一意インデックスがあります。

記事用にテーブル名とID生成を簡略化すると、構造は次のようになります。

```sql
CREATE TABLE push_token (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL
);
CREATE INDEX push_token_user_idx ON push_token(user_id);
```

実際のスキーマにはユーザーテーブルへの外部キーと作成時刻もあります。ここではトークンの所属関係に絞るため省いています。

`user_id`を一意にしないので、一人に複数行を持たせられます。`user_id + platform`も一意にしません。同じユーザーがiPhoneを二台使う場合、OSが同じでも送信先は二つだからです。

一方、同じ`token`の行を重複させる必要はありません。再起動のたびに再登録しても行が増えないよう、トークン自体を競合判定の対象にします。

[ExpoのFAQ](https://docs.expo.dev/push-notifications/faq/)には、Androidでの再インストールなど、Expo Push Tokenが変わり得る条件が記載されています。トークンは永続的なハードウェアIDとして扱わず、その時点の通知送信先として保存します。

## 登録時に、ほかの端末を消さない

変更後の登録APIは、認証済みセッションのユーザーIDと受け取ったトークンを使ってupsertします。先にユーザーの登録を全削除する処理は置きません。

```sql
INSERT INTO push_token (id, user_id, token, platform)
VALUES ('registration-a', 'user-a', 'token-ios', 'ios')
ON CONFLICT(token) DO UPDATE SET
  user_id = excluded.user_id,
  platform = excluded.platform;
```

このSQLで二つのケースを扱います。同じユーザーが同じトークンを再登録した場合は既存行を更新し、同じインストールでアカウントを切り替えた場合はそのトークンの所属だけを変更します。ほかのトークンには触れません。

実コードではDrizzleの`onConflictDoUpdate`で`pushTokens.token`を指定しています。直前に`findFirst`もありますが、これは計測イベントを記録するかどうかの判定です。登録の重複を防ぐ根拠は、その事前検索ではなくDBの一意制約とupsertです。

```text
user-a: token-ios, token-android
  token-androidをuser-bで再登録
user-a: token-ios
user-b: token-android
```

これはAPIが保持する関連の例です。トークン文字列を入力として受け付けること自体が、端末の所持を証明するわけではありません。トークンを公開ログへ出さないことや、登録APIの認証は別に守る必要があります。

## 解除は、ユーザーIDとトークンの両方で絞る

通常ログアウトの解除条件は、現在のユーザーと操作した端末のトークンです。

```sql
DELETE FROM push_token
WHERE user_id = 'user-a' AND token = 'token-android';
```

`user_id`だけで消すと、別端末も通知を受け取れなくなります。`token`だけで消すと、アカウント切り替え後に古いユーザーの解除要求が届いたとき、新しい所属の登録を消す余地があります。両方を条件にすれば、すでに`user-b`へ移ったトークンを`user-a`の解除で消しません。

アカウント削除時の全解除は別の操作として残します。同じDELETEでも、ログアウトと退会では対象範囲が違います。

## ログアウトと登録が交差すると、正しいDELETEだけでは足りない

登録が通信中のままログアウトすると、次の順序になり得ます。

```text
1. 端末が登録APIを呼ぶ
2. ログアウトが解除APIを呼ぶ
3. 解除が完了する
4. 遅れて登録が完了する
```

最後に登録が残ります。DELETEの条件に加え、実行順序も扱う必要があります。

実装の`DevicePushSession`は、登録中のPromiseとログアウト中のPromiseを保持します。ログアウト開始後は新しい登録を受け付けず、進行中の登録が終了してから解除します。二重ログアウトも同じ進行中Promiseを返します。

端末への記録とAPI保存にも順序があります。

```ts
async saveToken(token: string, save: () => Promise<unknown>) {
  const tokens = (await this.storage.read()) ?? [];
  await this.storage.write([...new Set([...tokens, token])]);
  await save();
}
```

これは実装から抜き出したメソッドです。端末内のトークン一覧を先に保存するため、サーバーが保存したあとに応答だけ失われても、ログアウト時の解除対象を端末側で把握できます。トークンが変わった場合は、以前の値も同じインストールの解除対象として残します。

端末の一覧はSecureStoreへ保存しています。解除に失敗したときは認証と一覧を残し、ログアウト失敗を表示して再試行できるようにしています。この選択には、オフラインでは通常のログアウトを完了できない制約があります。無条件に認証だけ消す設計とは、利用者への説明が変わります。

## 再実行したテストが確認する範囲

環境はNode.js `v24.15.0`、Vitest `4.1.4`です。モバイルの依存指定はExpo `~54.0.33`、React Native `0.81.5`。テスト自体はNode上で動きます。

```bash
pnpm --filter @squadnote/web exec vitest run src/security/push-token-privacy.test.ts
pnpm --filter @squadnote/mobile exec vitest run src/lib/device-push-session.test.ts
```

Web側は8件、モバイル側は9件が成功しました。Web側はインメモリのlibSQLと実tRPCルーターを使い、外部HTTPをモックにしています。モバイル側はストレージとAPI操作をテスト用の関数へ置き換えています。

| 確認対象 | 結果 |
| --- | --- |
| iOS、Android、同じOSの複数トークン | 複数行を保持 |
| 同じトークンの重複・並行登録 | 行とIDを維持 |
| 端末単位の解除、アカウント移管 | 対象以外の登録を保持 |
| 未認証の登録・解除 | 拒否 |
| 通知OFFと無効トークン | 送信対象を絞り、無効なトークンだけ削除 |
| 応答消失、登録と解除の競合、解除失敗 | 端末の記録と再試行の順序を確認 |

これらはD1本番環境の並行性能や、OSが通知を表示するところまでのテストではありません。実装の送信処理はExpoへの送信時のticketを調べますが、後続のreceipt取得まで実装済みとは言えません。Expoの受付成功を実機受信成功と読み替えないようにします。

## 旧アプリが残る間は、全解除も残る

互換用の`unregisterAllPushTokens`は残っています。旧版アプリがログアウトでこれを呼ぶと、別端末のトークンも削除されます。サーバーだけを更新すれば、どのバージョンのアプリでも安全になるわけではありません。

また、旧処理ですでに消されたトークンはDBから復元できません。各端末でアプリを起動し、登録し直す必要があります。

リポジトリの実機確認欄は、調査時点では未チェックでした。記事として確かめられたのは、登録の一意性、所属の移管、解除の範囲、通信が交差する場合の処理順序です。二台へ本当に届くかは、対応版を両端末へ適用したうえで、別途受信結果を記録する工程として残ります。

実装資料: [複数端末Push対応の仕様と検証条件](https://github.com/takahiro-saeki/circle-hub/blob/0cda1e865ad80d1529197729d8d436e96d56edc7/docs/multi-device-push.md)
