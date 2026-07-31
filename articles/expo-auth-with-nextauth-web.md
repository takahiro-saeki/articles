---
title: "NextAuthで動くWebサービスにExpoアプリの認証を後付けした構成と残った課題"
emoji: "🔑"
type: "tech"
topics: ["expo", "reactnative", "nextauth", "nextjs", "jwt"]
published: false
---

NextAuth(Auth.js)で認証しているNext.jsのWebサービスに、後からExpo(React Native)のアプリを追加しました。ここで問題になるのが認証です。NextAuthはセッションCookie前提の設計で、モバイルアプリとCookieの相性は良くありません。

別の認証基盤へ乗り換える方法もありますが、今回はWeb側の認証をNextAuthのまま残し、モバイル用にJWTの発行口を追加しました。運用中のサービスで使っている構成と、実装後に残った課題をまとめます。完成形として勧める記事ではなく、既存Webサービスへアプリを追加したときの記録です。

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

### 現在のリダイレクト検証と、その問題

`redirect` パラメータに任意のURLを渡せると、発行したJWTが意図しない場所へ送られます。現在は自分のアプリで使うスキームに絞っています。

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

ただし、この前方一致だけで十分とは考えていません。URLをパースし、schemeだけでなくhostとpathまで照合する方が安全です。開発用の `exp://` も許可範囲が広いため、本番ではcustom schemeの決めたコールバック先だけを受け付ける構成に分ける必要があります。

もう1つの課題は、JWTそのものをリダイレクトURLへ含めていることです。ExpoのAuthSessionは認可コードを受け取る構成を取れます。今後は短時間だけ使えるコードをアプリへ返し、サーバー側でJWTと交換する方式へ変える予定です。現在のコードを、そのまま認証設計のひな形として使うことは勧めません。

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

この構成では、Webとモバイルから同じprocedureを呼べます。モバイル側は、tRPCクライアントの `headers()` で毎リクエストにトークンを付けます。CookieとBearerで認証経路が分かれるため、権限判定はprocedure側で共通化しています。

## 運用で足しておくと効く2つの部品

**401の自動ログアウト。** トークンはいつか失効します。fetchをラップして401を検知したらトークンを破棄してログイン画面へ戻す処理を最初に入れておくと、画面ごとのエラー処理が不要になります。

```ts
const authAwareFetch: typeof fetch = async (input, init) => {
  const response = await fetch(input, init);
  if (response.status === 401) void handleUnauthorized();
  return response;
};
```

**Appleのネイティブサインイン。** Appleだけは `expo-apple-authentication` を使う別ルートにしています。ネイティブで取得したcredentialをサーバーへPOSTし、検証後に同じ形式のJWTを返します。JWTを受け取った後の保存とAPI呼び出しは、ブラウザ経由のログインと共通です。

## この構成の割り切り

- JWTの失効管理はシンプルに有効期限のみです。即時失効(リモートログアウト)が必要になったら、トークンをDBに置くかバージョン番号方式を足すことになります
- NextAuthの周辺(セッション戦略やコールバック)には手を入れていないので、Web側の認証は無傷です。「動いているWebの認証を壊さずにアプリを足す」ことを最優先にした設計です

既存のWeb認証を残したままアプリを追加できた点は、この構成の利点でした。一方、JWTをURLで渡す部分とredirectの検証には改善余地があります。まず動かすために採用した構成と、公開前に解消したい課題を分けて考える必要がありました。

## 環境

- Expo SDK 54(expo-web-browser / expo-secure-store / expo-apple-authentication)
- Next.js 15 + NextAuth v5(beta)+ jose / tRPC v11
- コードは運用中のサービスから要点のみ抜粋しています
