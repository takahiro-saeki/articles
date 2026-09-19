---
title: "Next.jsのServer ActionsとRoute Handlersは、呼び出し元との約束から選ぶ"
emoji: "🚪"
type: "tech"
topics: ["nextjs", "react", "typescript", "設計"]
published: true
---

Next.jsでサーバー側の更新処理を書くとき、Server ActionにもRoute Handlerにも同じ業務処理を置けそうに見えます。違いを「フォームならAction、APIならRoute」と暗記するだけでは、モバイルアプリやCronからも呼びたくなったときに迷います。

選ぶ基準は、呼び出し元とどんな約束を持つかです。Next.jsの画面から操作し、画面遷移まで含めて扱うならActionを候補にします。URL、HTTPメソッド、認証ヘッダー、JSONの結果を、別の呼び出し元にも説明したいならRoute Handlerが合います。

この判断を、SquadNoteのフォームとCron用ルートから確認します。調査対象はコミット`0cda1e8`、手元のインストールはNext.js `15.5.15`、React `19.2.5`です。2026年9月11日に参照した公式ドキュメントは`16.3.4`を表示していました。最新の説明と、実際にテストしたバージョンは分けて記録します。

## フォームは、認証処理と戻り先を一緒に渡している

[アカウント連携の画面](https://github.com/takahiro-saeki/circle-hub/blob/0cda1e865ad80d1529197729d8d436e96d56edc7/apps/web/src/app/%28app%29/settings/_components/linked-accounts.tsx)には、関連箇所を短くすると次のコードがあります。

```tsx
<form
  action={async () => {
    "use server";
    await signIn(p.id, { redirectTo: "/settings" });
  }}
>
  <button type="submit">Connect</button>
</form>
```

ボタンの装飾などを省いた抜粋です。`p`は画面側で列挙している認証プロバイダーです。フォームからプロバイダーの認証処理へ進み、戻り先もこの画面に合わせて指定しています。

このActionは、画面で行った操作をサーバーへ渡す入口です。別のクライアント向けにJSONの形式を定義する必要は、ここではありません。

[公式のMutating Data](https://nextjs.org/docs/app/getting-started/mutating-data)では、フォームなどから呼ぶServer FunctionをServer Actionと説明しています。通信にはPOSTが使われ、画面以外から直接POSTされる可能性もあります。「画面にしかボタンがないから、その画面の権限確認で十分」とは扱えません。

上の抜粋は認証開始のコードで、任意の更新処理の認可テンプレートではありません。たとえば投稿削除へ置き換えるなら、操作時のユーザーと削除対象の所有関係を確認する必要があります。

## Cronの入口には、HTTPとして返す結果がある

[朝の通知ルート](https://github.com/takahiro-saeki/circle-hub/blob/0cda1e865ad80d1529197729d8d436e96d56edc7/apps/web/src/app/api/cron/morning-reminder/route.ts)は`POST(request: Request)`を公開しています。処理の順序は次の形です。

```text
POST /api/cron/morning-reminder
  設定されたsecretを取得
  設定なし → 500
  Authorizationヘッダー不一致 → 401
  当日の予定をDBから取得
  対象があればPush送信
  JSONで処理結果を返す
```

Cron側に説明したいのは、フォームへどの関数を渡すかではなく、どのメソッドで呼び、何をヘッダーに付け、どの結果を受け取るかです。この用途には、Web標準のRequestとResponseを扱う[Route Handler](https://nextjs.org/docs/app/getting-started/route-handlers)が対応しています。

同じ理由で、モバイルアプリや外部サービスにも使わせる入口は、HTTPの契約を明示すると管理しやすくなります。ただしRoute Handlerにしただけで、認証方式や再実行時の扱いまで決まるわけではありません。

## 「拒否した後にDBへ進まない」を実コードで確認する

このルートの固定コミットを一時ディレクトリへ取り出し、エクスポートされた`POST`を直接呼びました。DB取得とPush送信はモックし、認証条件を満たす前にそこへ進まないことを確認しています。

| 入力条件 | ステータス | DB取得 | Push送信 |
| --- | ---: | --- | --- |
| secretの設定なし | 500 | 呼ばない | 呼ばない |
| secretあり、ヘッダーなし | 401 | 呼ばない | 呼ばない |
| secretあり、ヘッダー不一致 | 401 | 呼ばない | 呼ばない |
| ヘッダー一致、予定0件のモック | 200 | 呼ぶ | 呼ばない |

4件すべて成功しました。Node.js `v24.15.0`、Vitest `4.1.4`、Next.js `15.5.15`での結果です。[検証スクリプト](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/next-route-entry.mjs)は、依存パッケージがインストール済みの対象リポジトリを指定して実行できます。

```bash
node experiments/article-stock-2026-09/next-route-entry.mjs ../circle-hub-multi-device-push
```

これは実ルート関数の検証ですが、Next.jsのHTTPサーバーは起動していません。ローカル用の環境変数を読む経路を使い、Cloudflare上のbinding取得、Cron発火、ネットワーク越しの呼び出し、実際の通知配信は検証対象から外しています。Actionの通信も、この4件で検証したわけではありません。

それでも、入口を関数として取り出すことで、どの条件で業務処理へ進むかを具体的に確認できます。200だけを確かめるテストでは、拒否する分岐が抜けていても気づけません。

## 再利用したいのは入口の奥にある処理

後から「この更新を管理画面とモバイルの両方から使いたい」となったとします。Actionを外部クライアント向けのAPI仕様としてそのまま流用するより、共通の業務関数と入口を分ける案を考えます。

```text
管理画面 → Action → セッション確認 ─┐
                                  ├→ 対象への操作権限・入力確認 → 更新
モバイル → Route  → API認証 ───────┘
```

これは今後の構成案であり、SquadNoteの二つの入口をこの形へ改修した結果ではありません。共通関数には、サーバー側で確認した実行者を渡すか、その関数自身で実行者を取得させます。フォームやJSONに入っていた`userId`を、確認済みの実行者として扱わないようにします。

業務上の権限確認を共通部分へ寄せる場合も、すべての入口から必ずその確認を通る必要があります。Action側にはフォーム入力の変換や画面の更新、Route側にはHTTP入力の変換やステータスの決定を残します。

[Data Securityの公式説明](https://nextjs.org/docs/app/guides/data-security)も、ページでの認証確認が、その中のActionに引き継がれるわけではないとしています。Actionから呼ぶデータアクセス層へ認証・認可を集める構成も示されています。ファイルに`use server`があることだけで、対象への操作権限を確認したことにはなりません。

入口を選ぶときは、呼び出し元、認証情報、入力、成功時と失敗時の返し方を書き出します。それが画面の操作として自然にまとまるならAction、独立したHTTP仕様として約束したいならRoute Handlerを選びます。共通化が必要になったら、その約束を保ちながら奥の業務処理を取り出します。
