---
title: "tRPC v11でNext.jsとExpoの型を共有する。個人開発Web+iOSアプリの実構成"
emoji: "🔗"
type: "tech"
topics: ["trpc", "nextjs", "expo", "reactnative", "typescript"]
published: true
---

Web(Next.js)とiOSアプリ(Expo / React Native)の両方を持つサービスを個人開発しています。この構成で一番避けたかったのは、APIの型定義を2箇所で管理することでした。サーバーのレスポンスが変わるたびにアプリ側の型を手で直す運用は、1人開発だと確実に破綻します。

tRPC v11とmonorepoを組み合わせると、Next.js側に書いたAPIの型がそのままExpo側の補完に流れてきます。サーバーのprocedureに項目を足すと、アプリのコードで即座に型エラーが出る。この記事では、運用中のサービス(サークル管理アプリ)の実構成を紹介します。

## 全体像

Turborepoのmonorepoで、こういう配置にしています。

```
├── apps/
│   ├── web/      ← Next.js 15。tRPCルーターの実体はここ
│   └── mobile/   ← Expo。tRPCクライアントとして接続
└── packages/
    ├── api/      ← AppRouter型をre-exportするだけのパッケージ
    └── design-tokens/
```

ポイントは、**tRPCルーターの実体はNext.jsの中に置いたまま**にしていることです。APIサーバーを別アプリに分離せず、Webが今まで通り `/api/trpc` を持ち、モバイルは外からそのエンドポイントを叩きます。サーバーが1つ減るので、デプロイもインフラ費用も増えません。

## packages/api は「型だけ」のパッケージ

`packages/api` の中身は、実質これだけです。

```ts
// packages/api/src/index.ts
export type { AppRouter } from "../../apps/web/src/server/api/root";
export type { RouterInputs, RouterOutputs } from "../../apps/web/src/trpc/react";
```

ルーター定義をパッケージに移すのではなく、型だけをre-exportしています。`export type` なので、モバイル側のバンドルにサーバーコードが混入することはありません。型チェック時にだけ参照されます。

ルーター定義ごとpackagesに移す設計も考えましたが、DBクライアントや認証などNext.js側の依存を大量に引き連れることになるので、まずは型の共有だけで始めました。パッケージのコメントに「将来ルーター定義自体を移す可能性がある」と書き残して、先送りにしています。今のところ困っていません。

## モバイル側のクライアント

Expo側は `createTRPCReact` にAppRouter型を渡すだけで、Webと同じ書き味のフックが手に入ります。

```ts
// apps/mobile/src/lib/trpc.ts
import { createTRPCReact, httpBatchLink } from "@trpc/react-query";
import superjson from "superjson";
import type { AppRouter } from "@squadnote/api";

export const api = createTRPCReact<AppRouter>();

export function createTrpcClient() {
  return api.createClient({
    links: [
      httpBatchLink({
        url: config.trpcUrl, // Next.jsの /api/trpc を指す
        transformer: superjson,
        async headers() {
          const token = await getToken(); // SecureStoreから取得
          return token ? { authorization: `Bearer ${token}` } : {};
        },
      }),
    ],
  });
}
```

これで画面側は `api.schedule.list.useQuery(...)` のように書けて、入力も出力も全部型が付きます。サーバーのprocedureを変更してアプリ側の使用箇所が壊れると、その場で赤線が出ます。この体験を一度知ると、REST + 手書き型定義には戻れません。

transformerのsuperjsonは、サーバーとクライアントで必ず揃えます。これがズレるとDateがstringになって届くような事故が起きます。

## 認証だけはWebとモバイルで別物になる

型共有そのものより、実装で悩んだのはここでした。Webの認証はNextAuthのセッションCookieで動きますが、モバイルアプリはCookieベースの認証と相性が良くありません。

なのでモバイル用にはトークン認証の口を別に用意しました。

- ログイン成立時にモバイル用のJWTを発行し、Expo側は `expo-secure-store` に保存
- tRPCクライアントの `headers()` で毎リクエストに `Authorization: Bearer` を付与
- サーバー側のtRPCコンテキストは「Cookieセッション or Bearerトークン」のどちらでも認証を通す

もう1つ、モバイルならではの処理として401の自動ログアウトを入れています。fetchをラップして、401が返ってきたらトークンを破棄してログイン画面に戻す作りです。

```ts
const authAwareFetch: typeof fetch = async (input, init) => {
  const response = await fetch(input, init);
  if (response.status === 401) {
    void handleUnauthorized(); // トークン破棄 → /login へ
  }
  return response;
};
```

トークンの失効はいつか必ず起きるので、ここを最初に作っておくと画面ごとのエラー処理が要らなくなります。

## 運用してみての注意点

**公開済みprocedureの破壊的変更は慎重に。** Webはデプロイすれば全ユーザーが新コードになりますが、モバイルはストア審査と各ユーザーのアップデートを挟むため、古いバージョンのアプリがしばらくAPIを叩き続けます。procedureの削除や入力形式の変更は、型エラーでは守れない(旧バイナリは型チェックの外にいる)ので、後方互換を保つか、レスポンスを寛容にしておく必要があります。monorepoで型が繋がっていると全部同期している気分になりますが、実際に配布されるのは過去のスナップショットです。

**RouterInputs / RouterOutputsが地味に便利。** procedureの入出力型をユーティリティ型で取り出せるので、画面側で「この一覧のitem型」を書きたいときに手書きの型を作らずに済みます。

```ts
import type { RouterOutputs } from "@squadnote/api";
type Schedule = RouterOutputs["schedule"]["list"][number];
```

## おわりに

この構成にすると、「APIとアプリの型がズレる」という種類の問題はコンパイル時に検出される問題に変わります。WebとiOSを1人で回す上で、実行してみるまで分からないバグが1ジャンル消えるのは大きい。API部分の設計判断は「ルーターをどこに置くか」くらいで、あとはtRPCが面倒を見てくれます。

Web+モバイルの個人開発を考えている方の参考になれば嬉しいです。

## 環境

- tRPC v11 / @trpc/react-query + TanStack Query v5 / superjson
- Next.js 15(App Router)+ Expo SDK 54(React Native 0.81)
- Turborepo + pnpm workspace
- 同じ構成でWeb+iOSのサービスを2本運用しています。コード例は実物を記事用に簡略化したものです
