---
title: "認証エラーのConfigurationを原因と決めつけず、復旧を確認する"
emoji: "🔐"
type: "tech"
topics: ["nextauth", "認証", "テスト", "運用"]
published: false
---

ログイン後の戻り先に`error=Configuration`が付いていると、設定値の間違いを疑いたくなります。ところが、今回確認したAuth.jsではPKCE Cookieの欠落もその表示へつながりました。画面へ出る分類だけでは、発生原因を特定できません。

SquadNoteの認証復旧コードを読み、実際に使うAuth.jsの版と関連テストを確認しました。ここで整理するのは、原因の断定に進む前に、拒否された処理、再試行の導線、診断の証拠を順に調べる方法です。

対象は`circle-hub`の`d116e8a`、確認日は2026年9月11日です。本番の認証ログや利用者の操作履歴は取得していません。本番障害の原因や解消を立証する記事ではなく、復旧のために追加されたコードと、今回再実行した検証を扱います。

## 同じConfigurationでも、内部のエラーを分けて見る

[Auth.jsのInvalidCheck説明](https://authjs.dev/reference/core/errors#invalidcheck)では、PKCE、state、nonceの検査を実施できない場合を扱っています。設定だけでなく、Cookieが使えない場合も含まれます。

[リポジトリの回帰テスト](https://github.com/takahiro-saeki/circle-hub/blob/d116e8a343e8d9e7ddd3d1985efe590fa1901868/apps/web/src/server/auth/auth-core-recovery.test.ts)は、アプリが使う`next-auth`から依存先の`@auth/core`を解決します。別途インストールした最新版で代用するテストではありません。

PKCE Cookieを付けない合成コールバックを渡すと、今回の環境では次の結果になりました。

| 観測する場所 | 確認結果 |
| --- | --- |
| HTTP status | 302 |
| リダイレクト先 | `/sign-in/error?error=Configuration` |
| loggerへ渡った内部type | `InvalidCheck` |

この試験で確認した原因は、fixtureで意図的に欠落させたPKCE Cookieです。実利用で同じ内部typeを見ても、そのCookieがなぜ来なかったのかは別途調べます。期限切れ、別の開始操作、ブラウザの挙動などを、この一つの表示から選べるわけではありません。

## まず、失敗画面から新しい開始へ戻れるようにする

[復旧設計の記録](https://github.com/takahiro-saeki/circle-hub/blob/d116e8a343e8d9e7ddd3d1985efe590fa1901868/docs/auth-recovery-diagnostics.md)と履歴は、`061a5f2`の復旧画面、`2b88c31`の連打対策、`7f180ad`の診断追加という順番です。

復旧画面は`auth()`やDBに依存せず、再ログインと公開ヘルプへの導線を表示します。認証が失敗している画面を表示するために、もう一度同じ認証へ依存しない設計です。

戻り先は同じオリジンの安全なパスに限定します。招待ページへの復帰は残しつつ、外部転送や認証画面へのループを拒否するテストがあります。元のコールバックURLを無条件に再利用する仕組みではありません。

実Auth.jsへ新しい開始要求を二度渡したテストでは、異なるPKCE challengeと`S256`の指定、新しいPKCE Cookieが返ることを確認しました。ただし、この開始試験は内部のCSRFスキップ指定を使うfixtureです。実ブラウザでのCSRF保護やOAuthプロバイダとの往復を確認した結果ではなく、本番設定でCSRF検証を無効にする変更もしていません。

## Reactの再描画を待たずに、二度目の開始を止める

ログインボタンを無効表示にするだけでは、再描画までの間に別のボタンが押される余地があります。実装には、GoogleとAppleの開始を同じ画面内で止める同期ガードがあります。

```ts
export function createSubmissionGuard() {
  let submitting = false;
  return {
    acquire() {
      if (submitting) return false;
      submitting = true;
      return true;
    },
    reset() { submitting = false; },
  };
}
```

[実際のガード](https://github.com/takahiro-saeki/circle-hub/blob/d116e8a343e8d9e7ddd3d1985efe590fa1901868/apps/web/src/app/sign-in/submission-guard.ts)に対するテストでは、直後の再取得を拒否し、失敗や履歴復帰に対応するreset後には再取得でき、別インスタンスへ状態を共有しないことを確認しています。

これは同一画面内の連打を抑える範囲です。別タブや別ブラウザからの同時開始まで一つにまとめるロックではありません。また、ガードを入れても、Cookieが返らないすべての原因が消えるわけではありません。

## 診断ログで、どこまで進んだかを照合する

診断の実装は、認証情報の値を保存せずに開始とコールバックの前後を調べるものです。主要なイベントは次の役割を持ちます。

| イベント | 読み取れること |
| --- | --- |
| `auth.sign_in_started` | 開始要求があった |
| `auth.authorization_redirect` | 開始処理が戻り先を生成した |
| `auth.callback_received` | コールバックを受信した |
| `auth.sign_in_succeeded` | Auth.jsのsignInイベントが発生した |
| `auth.server_error` | 失敗と診断情報が記録された |

開始やリダイレクト生成は、ログイン成功を意味しません。特にサーバーアクション側の`cookiesAfterStart`は、その時点のCookie jar内の存在を見ています。既存Cookieを含む可能性があるため、存在するだけで今回新しく発行したと断定しません。

`requestId`は失敗したリクエスト、`attemptId`は開始との照合に使います。後者のマーカーはクライアント由来の補助情報で、認証判断には使いません。同じブラウザの最後の開始を示すため、複数タブでは同一OAuthトランザクションの証明にもなりません。

マーカーがない、期限を過ぎた、プロバイダが違うといった場合には、照合できないことがあります。その結果を「開始要求がなかった」と言い換えず、照合できなかった理由を残します。

## 診断を足して、認証の条件を緩めない

診断のテストは、Cookie値、認可コード、トークン、生のUser-Agent、IPなどの合成した機密値がログへ入らないことを確認しています。Cookieは名前を限定した有無だけを残し、パスも認証ルートへ限定します。

また、並行するリクエストの診断情報が混ざらないこと、診断や通知が失敗しても認証応答を壊さないこと、元のAuth.js応答のCookieを維持することもテストしています。PKCE、state、nonceの検証条件を緩めた結果としてログインを通す変更ではありません。

通知の抑制はWorkerインスタンス内の仕組みで、分散したすべてのインスタンスを通した配送保証ではありません。診断Cookieもセッションの代用ではありません。この二つを認証の成立条件へ混ぜないことが、コードを読む際の境界です。

## 今回の47テストと、実環境に残る確認

固定コミットの8ファイル、47テストを一時コピーで再実行しました。Node.js `v24.15.0`、Vitest `4.1.4`、Next.js `15.5.15`、next-auth `5.0.0-beta.25`、その依存のAuth.js core `0.37.2`を使っています。[実行スクリプト](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/batch05-circle-tests.py)と[結果](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/production/2026-09/batch-05/auth-tests.json)を保存しました。

テストには実Auth.jsを呼ぶものと、ルートや通知の依存先をモックに置くものがあります。実Google・Appleアカウント、Safariやアプリ内ブラウザ、複数タブ、実際のCookie削除操作は今回確認していません。過去の文書にあるUI確認記録も、今回再実行した結果とは分けています。

復旧確認では、失敗の分類、新しい開始、安全な戻り先、同一画面の連打、ログで照合できる範囲を順に確かめます。原因が未確定の段階では、再試行できる条件と、追加で調べる項目を記録します。
