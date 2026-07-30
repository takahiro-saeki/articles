---
title: "NextAuthで動くWebサービスにExpoアプリの認証を後付けする設計(WebBrowser + JWT)"
emoji: "🔑"
type: "tech"
topics: ["expo", "reactnative", "nextauth", "nextjs", "jwt"]
published: false
---

NextAuth(Auth.js)で認証しているNext.jsのWebサービスに、後からExpo(React Native)のアプリを追加しました。ここで問題になるのが認証です。NextAuthはセッションCookie前提の設計で、モバイルアプリとCookieの相性は良くありません。

Auth.jsのExpo公式サポートを待つ・別の認証基盤に乗り換える、という選択肢もありましたが、私は**Web側の認証はNextAuthのまま、モバイル用にJWTの発行口を足す**構成にしました。運用中のサービスで実際に動いているフローを、セキュリティ上の考慮点まで含めて書きます。

## 全体像

登場人物は3つです。

- **Web(Next.js)**: NextAuth + Google/Apple OAuth。セッションはCookie
- **モバイル(Expo)**: CookieではなくBearerトークン(JWT)で認証
- **橋渡し**: WebのOAuthフローをアプリ内ブラウザで実行し、完了時にJWTをアプリへ渡す

```
アプリ                    Web (Next.js)
  │ openAuthSessionAsync     │
  ├────────────────────────→ │ /api/auth/mobile-callback?action=login&redirect=exp://...
  │                          │   → NextAuthのsign-in → Google OAuth
  │                          │   → OAuth完了、Cookieセッション成立
  │                          │   → JWTを発行
  │ ←──────────────────────  │   → exp://...?token=xxx へリダイレクト
  │ トークンをSecureStoreへ    │
  │                          │
  │ 以降のAPI: Authorization: Bearer xxx
```

## モバイル側: openAuthSessionAsyncで水路を作る

Expo側のログインボタンは、`expo-web-browser` でWebのログインフローを開くだけです。

```tsx
import * as WebBrowser from "expo-web-browser";

const redirectUrl = Linking.createURL("/login"); // exp:// または squadnote://
const loginUrl = `${config.apiUrl}/api/auth/mobile-callback?action=login&redirect=${encodeURIComponent(redirectUrl)}`;

const result = await WebBrowser.openAuthSessionAsync(loginUrl, redirectUrl);
// result.url に exp://...?token=xxx が返ってくる
```

`openAuthSessionAsync` は「認証用のアプリ内ブラウザを開き、指定スキームへのリダイレクトが起きたらアプリに戻る」というAPIで、OAuthの水路としてそのまま使えます。

受け取ったトークンは `expo-secure-store` に保存します。

```ts
import * as SecureStore from "expo-secure-store";

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync("squadnote_jwt", token);
}
```

## サーバー側: mobile-callbackがJWTを発行する

Web側に足したのは、モバイル専用のコールバックRoute Handlerです。やることは3段階です。

1. `?action=login` で来たら、モバイルのリダイレクト先をCookieに覚えてNextAuthのsign-inへ流す
2. OAuthが完了して戻ってきたら、成立したCookieセッションから `auth()` でユーザーを特定
3. JWTを発行して、モバイルのスキームへ `?token=xxx` 付きでリダイレクト

```ts
// /api/auth/mobile-callback(要点のみ)
export async function GET(request: Request) {
  const session = await auth(); // OAuth完了後はCookieセッションが生きている
  if (!session?.user?.id) { /* sign-inへ */ }

  const token = await signJwt(session.user.id, secret); // joseで署名
  return NextResponse.redirect(`${mobileRedirect}?token=${token}`);
}
```

### オープンリダイレクト対策は必須

このフローで一番危ないのは、`redirect` パラメータに任意のURLを渡せてしまうと**発行したJWTが攻撃者のサーバーへ飛ぶ**ことです。リダイレクト先は自分のアプリのスキームだけに絞ります。

```ts
// redirect先はExpo開発スキーム or 本番のcustom schemeのみ許可
function isAllowedMobileRedirect(redirect: string): boolean {
  return (
    redirect.startsWith("exp://") ||
    redirect.startsWith("exps://") ||
    redirect.startsWith("squadnote://")
  );
}
```

allowlist方式(前方一致)にしているのがポイントです。「http以外なら良い」のような否定形の条件は抜け道を作りがちです。

## APIはCookieとBearerの二刀流にする

tRPC(またはAPI)のコンテキスト側は、Cookieセッションを先に試して、無ければBearerトークンを検証するフォールバック構成にします。

```ts
// tRPCコンテキスト(要点のみ)
// Web: Cookieセッション / Mobile: Authorization: Bearer <JWT>
const session = await auth();
if (!session) {
  const authHeader = opts.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const payload = await verifyJwt(authHeader.slice(7), secret);
    // payloadのユーザーIDでセッション相当を組み立てる
  }
}
```

これでWebとモバイルが**同じprocedureを同じ権限モデルで**叩けます。クライアント側(モバイル)は、tRPCクライアントの `headers()` で毎リクエストにトークンを付けるだけです。

## 運用で足しておくと効く2つの部品

**401の自動ログアウト。** トークンはいつか失効します。fetchをラップして401を検知したらトークンを破棄してログイン画面へ戻す処理を最初に入れておくと、画面ごとのエラー処理が不要になります。

```ts
const authAwareFetch: typeof fetch = async (input, init) => {
  const response = await fetch(input, init);
  if (response.status === 401) void handleUnauthorized();
  return response;
};
```

**Appleのネイティブサインイン。** iOSではWebブラウザ経由よりネイティブの `expo-apple-authentication` の方が体験が良い(Face IDで一瞬)ので、Appleだけ別ルートにしています。ネイティブで取得したcredentialをサーバーへPOSTし、検証してから同じ形式のJWTを返す専用エンドポイントを用意する形です。出口を「同じJWT」に揃えておけば、以降の処理は完全に共通化できます。

## この構成の割り切り

- JWTの失効管理はシンプルに有効期限のみです。即時失効(リモートログアウト)が必要になったら、トークンをDBに置くかバージョン番号方式を足すことになります
- NextAuthの周辺(セッション戦略やコールバック)には手を入れていないので、Web側の認証は無傷です。「動いているWebの認証を壊さずにアプリを足す」ことを最優先にした設計です

Auth.js側のモバイル対応が成熟すればもっと素直な書き方になるはずですが、「今動くWebサービスにアプリを足したい」場面では、この橋渡し方式が現実的な落とし所だと思います。

## 環境

- Expo SDK 54(expo-web-browser / expo-secure-store / expo-apple-authentication)
- Next.js 15 + NextAuth v5(beta)+ jose / tRPC v11
- コードは運用中のサービスから要点のみ抜粋しています
