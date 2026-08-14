---
title: "Next.jsとExpoで同じ認証、権限モデルを使うまでの設計変遷"
emoji: "🔐"
type: "tech"
topics: ["nextjs", "expo", "nextauth", "trpc", "authentication"]
published: true
---

NextAuthで動いていたNext.jsサービスへExpoアプリを追加しました。WebはCookie、モバイルはBearer JWTを使います。認証方法は別ですが、APIへ入った後のセッション形式と権限判定は共通にしました。

最初からこの形だったわけではありません。モバイルでGoogle認証を直接扱う構成、Web認証をアプリ内ブラウザから使う構成を経て、現在の境界に落ち着いています。

## WebはNextAuthのCookieを維持した

既存WebはNextAuthのセッションを使っています。ここをモバイル追加のために置き換えると、ログイン、アカウント連携、既存セッションへ影響します。

そこでWebはそのまま残し、モバイルだけJWTを使う入口を追加しました。

```text
Web     -> Cookie -> tRPC context
Mobile  -> Bearer JWT -> tRPC context
                        -> 同じsession.user
```

## モバイルはWebのOAuthを経由する

Expoから`openAuthSessionAsync`でWebの認証を開きます。OAuth完了後、サーバーが短い認証フローを経てアプリ用JWTを返し、アプリは`SecureStore`へ保存します。

```ts
const result = await WebBrowser.openAuthSessionAsync(loginUrl, redirectUrl);
```

APIリクエストではAuthorizationヘッダーへ載せます。

```ts
async headers() {
  const token = await getToken();
  return token ? { authorization: `Bearer ${token}` } : {};
}
```

## tRPC contextで同じユーザー形式へ揃える

サーバーは最初にCookieセッションを確認し、なければBearer JWTを検証します。

```ts
const session = await auth();

if (!session?.user) {
  const header = opts.headers.get("authorization");
  if (header?.startsWith("Bearer ")) {
    const result = await verifyJwt(header.slice(7), secret);
    // DBからユーザーを読み、session.userと同じ形にする
  }
}
```

JWTにはユーザーIDだけを入れています。`name`、`email`、`image`はDBから取得し、Webの`session.user`と同じshapeにします。通知文でユーザー名を使う処理も、アクセス元を意識せずに済みます。

## 認証と認可を分ける

ログイン済みかどうかは`protectedProcedure`で確認します。団体内の操作権限は、別の認可ヘルパーで判定します。

```ts
await assertMember(ctx, organizationId);
await assertAdminOrOwner(ctx, organizationId);
```

モバイル画面でボタンを隠しても、API側の確認は省きません。画面の権限表示は操作性のため、サーバーの認可はデータ保護のためです。

## 401はモバイル側で一度だけ処理する

JWTが期限切れになった場合、並列リクエストが一斉に401を返すことがあります。各queryが個別にログアウト処理をすると、遷移が重なります。

```ts
let isHandlingUnauthorized = false;

async function handleUnauthorized() {
  if (isHandlingUnauthorized) return;
  isHandlingUnauthorized = true;
  await clearAuth();
  router.replace("/login");
}
```

認証方式を完全に共通化するのではなく、API contextより後ろを共通化しました。Webとモバイルは資格情報の持ち方が違います。一方、ユーザーIDを得た後の権限モデルは同じです。この境界なら、既存Webを保ちながらモバイルを追加できました。
