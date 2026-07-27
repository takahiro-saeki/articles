---
title: NextAuth v5のセッションはJWTなのかDBなのか ― adapterと戦略の分岐を本番構成で整理する
tags:
  - NextAuth
  - Auth.js
  - Next.js
  - TypeScript
  - Drizzle
private: false
updated_at: ''
id: null
organization_url_name: null
slide: false
ignorePublish: false
posting_campaign_uuid: null
agreed_posting_campaign_term: false
---

## TL;DR

- NextAuth (Auth.js) v5 のセッション戦略は **「adapterを設定したかどうか」で暗黙に切り替わる**
  - adapterなし → `jwt`(暗号化JWTをCookieに保存)
  - adapterあり → `database`(セッションはDBのテーブル、Cookieはただの参照トークン)
- ただし **Credentials プロバイダは database 戦略ではセッションが作られない**ので、`strategy: "jwt"` の明示が必要
- 戦略によって `session` コールバックに渡ってくる引数が **`token` と `user` で変わる**。「なんとなくコピペしたら動いた」の原因はだいたいここ
- 本番プロダクト(OAuth=DBセッション、テスト環境のみCredentials=JWT)で両方を運用している実際の設定を晒しながら整理します

## 「なんとなく動いている」の正体

NextAuthを使っていて、こういう状態になったことはないでしょうか。

- チュートリアル通りに書いたら動いたが、**セッションがどこに保存されているのか答えられない**
- `session` コールバックの引数に `token` を書いている記事と `user` を書いている記事があり、**どちらが正しいのか分からない**
- Credentialsプロバイダを追加したら**ログインできたはずなのにセッションが取れない**

私も2つの個人開発プロダクト(Web + iOSアプリ)でNextAuth v5を運用していますが、正直この分岐を「なんとなく」で扱っていた時期が長かったので、改めて整理しました。

## 大前提: セッション戦略は2つある

| | `jwt` 戦略 | `database` 戦略 |
|---|---|---|
| セッションの実体 | 暗号化JWT(JWE)そのものがCookie | DBの `sessions` テーブルの行 |
| Cookieの中身 | クレームを含む暗号化トークン | ランダムなセッショントークン(DBへの参照キー) |
| サーバー側の照会 | 不要(復号だけ) | 毎回DBを引く |
| 即時失効(強制ログアウト) | 難しい | DBの行を消すだけ |
| `session` コールバックの引数 | `{ session, token }` | `{ session, user }` |

そして重要なのが**デフォルト値の決まり方**です。明示しなければ:

- **adapterを渡していない → `jwt`**
- **adapterを渡している → `database`**

つまり「DrizzleAdapterを繋いだ瞬間に、セッションの保存場所がCookieからDBへ静かに切り替わる」わけです。挙動が変わったことに気付かないままコールバックだけ古い記事からコピペすると、`token` が `undefined` で首をかしげることになります。

## Credentialsだけは例外

もう1つのハマりどころがCredentialsプロバイダです。Credentialsによるログインでは**databaseセッションが作成されません**。adapterを設定した状態(=デフォルトがdatabase戦略)でCredentialsログインすると、認証自体は通るのにセッションが保存されず「ログインしたのにされていない」状態になります。

対処はシンプルで、Credentialsを使うときは `session: { strategy: "jwt" }` を明示すること。ただしこれは全プロバイダに効くグローバル設定なので、「OAuthはDBセッションで運用し、Credentialsも併用する」は素直にはできません。

## 本番でどう使い分けているか

私のプロダクト(squadnote)では、この制約を逆手に取ってこう運用しています。

- **本番: Google / Apple OAuth のみ → database戦略**(デフォルトのまま)
- **E2Eテスト・開発環境のみ: テストログイン用Credentialsを有効化 → jwt戦略に切り替え**

実際の設定はこうなっています(抜粋)。

```ts
export function getAuthConfig(env?: { ENABLE_TEST_LOGIN?: string /* ... */ }): NextAuthConfig {
  const enableTestLogin = env?.ENABLE_TEST_LOGIN === "true";

  const providers: NextAuthConfig["providers"] = [
    Google({ /* ... */ }),
    Apple({ /* ... */ }),
  ];

  if (enableTestLogin) {
    providers.push(
      Credentials({
        id: "test-login",
        async authorize(credentials) { /* テストユーザーを返す */ },
      }),
    );
  }

  return {
    providers,
    adapter: drizzleAdapter, // ← これがある時点でデフォルトは database 戦略
    // Credentials Provider は JWT セッション戦略が必要
    session: enableTestLogin ? { strategy: "jwt" } : undefined,
    callbacks: {
      // 戦略によって session コールバックの「相方」が変わる
      jwt: enableTestLogin
        ? ({ token, user }) => {
            if (user) token.id = user.id; // 初回ログイン時のみ user が渡ってくる
            return token;
          }
        : undefined,
      session: enableTestLogin
        ? ({ session, token }) => ({
            // jwt 戦略: DB を引かないので token から復元する
            ...session,
            user: { ...session.user, id: (token as { id?: string }).id ?? "" },
          })
        : ({ session, user }) => ({
            // database 戦略: sessions と JOIN された user がそのまま渡ってくる
            ...session,
            user: { ...session.user, id: user.id },
          }),
    },
  };
}
```

ポイントは3つあります。

1. `session: enableTestLogin ? { strategy: "jwt" } : undefined` — **undefinedを渡せばデフォルトの分岐(adapterあり=database)に任せられる**
2. jwt戦略のときだけ `jwt` コールバックが必要。`user` が渡ってくるのは**サインイン直後の1回だけ**で、以降のリクエストでは `token` に自分で書き込んだ値だけが頼り
3. `session` コールバックは戦略ごとに引数が違うので、**両対応するなら2系統書く**しかない

## 確認方法: いまどちらの戦略で動いているか

自分のアプリがどちらで動いているかは、次の2点を見れば一発でわかります。

1. **DBの `sessions`(相当の)テーブルに行が増えるか** — 増えるならdatabase戦略
2. **セッションCookie(`authjs.session-token`)の中身** — `eyJ...` 形式の長いトークン(JWE)ならjwt戦略、短いランダム文字列ならdatabase戦略の参照トークン

Drizzle + D1で運用している場合は `wrangler d1 execute <db> --command "select * from session"` あたりで確認できます。

## まとめ

| 状況 | 戦略 | やること |
|---|---|---|
| adapterなし | jwt(デフォルト) | `jwt`/`session` コールバックで `token` を扱う |
| adapterあり・OAuthのみ | database(デフォルト) | `session({ session, user })` で `user` を使う |
| Credentials使用 | **jwt必須** | `strategy: "jwt"` を明示。DBセッションとの併用は不可 |
| OAuth=DB、Credentials=テストのみ | 環境で切替 | 本記事の構成(環境変数で `strategy` とコールバックを出し分け) |

「adapterを入れた瞬間に戦略が切り替わる」「Credentialsはjwt必須」— この2つを押さえるだけで、NextAuthのセッション周りの「なんとなく」はだいぶ解消されるはずです。

## 環境

- next-auth 5.0.0-beta.25 / @auth/drizzle-adapter 1.7.x
- Next.js 15(App Router)+ Drizzle ORM + Cloudflare D1(@opennextjs/cloudflare)
