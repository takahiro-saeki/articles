---
title: tRPCのRouterInputs / RouterOutputsで「手書きの型」を消す小技集
tags:
  - tRPC
  - TypeScript
  - React
  - Next.js
private: false
updated_at: ''
id: null
organization_url_name: null
slide: false
ignorePublish: false
posting_campaign_uuid: null
agreed_posting_campaign_term: false
---

tRPCを使っているのに、画面側で `interface Schedule { ... }` のような型を手書きしていたら、それはたぶんtRPCの恩恵を半分捨てています。ルーター定義から全procedureの入出力型を取り出せるユーティリティ型があり、これを使うと「APIの型を画面用にもう一度書く」作業が消えます。

私はWeb(Next.js)とモバイル(Expo)のmonorepoでtRPC v11を使っていて、この2つの型をパッケージ経由で全アプリに配っています。定義はこれだけです。

```ts
import { type inferRouterInputs, type inferRouterOutputs } from "@trpc/server";
import { type AppRouter } from "~/server/api/root";

/** 全procedureの入力型 */
export type RouterInputs = inferRouterInputs<AppRouter>;
/** 全procedureの出力型 */
export type RouterOutputs = inferRouterOutputs<AppRouter>;
```

以下、これで手書き型を消していく小技です。

## 1. 一覧のitem型を取り出す

一番よく使うやつです。`findMany` 系のprocedureから配列要素の型を作ります。

```ts
type Schedule = RouterOutputs["schedule"]["list"][number];
```

`[number]` で配列の要素型が取れます。サーバー側のselectやincludeを変えると、この型も勝手に追従します。

## 2. 子コンポーネントのpropsに使う

一覧ページで取得したデータを子コンポーネントへ配るとき、propsの型をここから作ります。

```tsx
type Props = {
  schedule: RouterOutputs["schedule"]["list"][number];
  onSelect: (id: string) => void;
};

function ScheduleCard({ schedule, onSelect }: Props) {
  // schedule.title などが全部補完される
}
```

「APIレスポンスの型」と「コンポーネントのprops型」が同じ源から出ているので、サーバーの変更でズレたら子コンポーネント側にも型エラーが出ます。

## 3. ネストしたプロパティの型も添字で掘れる

リレーションを含むレスポンスなら、そのまま添字アクセスで掘れます。

```ts
type Member = RouterOutputs["membership"]["listByOrg"][number];
type MemberUser = Member["user"]; // withで取得しているリレーション先の型
```

## 4. フォームの型はRouterInputsから作る

作成・更新フォームの値の型は、mutationの入力型から取るとzodスキーマと二重管理になりません。

```ts
type CreateScheduleInput = RouterInputs["schedule"]["create"];

// 一部だけ使いたければユーティリティ型で加工
type ScheduleFormValues = Omit<CreateScheduleInput, "orgId">;
```

サーバー側で `.input(z.object({...}))` に項目を足すと、フォーム側が型エラーで教えてくれます。

## 5. キャッシュ更新(setQueryData)の型も合う

TanStack Queryのキャッシュを直接更新する楽観的更新でも、この型がそのまま使えます。

```ts
utils.schedule.list.setData({ orgId }, (old) =>
  old?.map((s) => (s.id === id ? { ...s, done: true } : s)),
);
// old は RouterOutputs["schedule"]["list"] | undefined として推論される
```

`setData` のコールバック引数は最初から正しく推論されるので、型注釈を書く必要すらありません。「手で型を書かない」を徹底するほど、推論の恩恵が連鎖します。

## monorepoならパッケージからre-exportしておく

WebとモバイルでtRPCクライアントを共有している場合は、`packages/api` のような型専用パッケージからAppRouterと一緒にre-exportしておくと、どのアプリからも同じ書き方で使えます。

```ts
// packages/api/src/index.ts
export type { AppRouter } from "../../apps/web/src/server/api/root";
export type { RouterInputs, RouterOutputs } from "../../apps/web/src/trpc/react";
```

## まとめ

- 画面側の型は手書きせず `RouterOutputs["ルーター"]["procedure"]` から作る
- 配列は `[number]`、ネストは添字アクセスで掘る
- フォームは `RouterInputs` から。zodスキーマとの二重管理を防ぐ
- 「サーバーを変えたらクライアントに型エラーが出る」状態を保つことが、tRPCを使う目的そのもの

## 環境

- tRPC v11 / TypeScript 5系 / Next.js 15 + Expo(Turborepo monorepo)
