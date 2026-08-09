---
title: "Webとモバイルで共通機能を作るとき、どこまでmonorepoで共有するか"
emoji: "🧩"
type: "tech"
topics: ["monorepo", "nextjs", "expo", "trpc", "typescript"]
published: true
---

Next.jsのWeb版へExpoアプリを追加したとき、最初はできるだけ多くのコードを共有したくなりました。実際に運用すると、共有しやすいのは型と業務ルールで、UIと実行環境への依存は分けた方が扱いやすいと分かりました。

SquadNoteはpnpm workspaceとTurborepoを使い、`apps/web`、`apps/mobile`、`packages/*`で構成しています。

## 現在の分け方

```text
apps/
  web/       Next.js、Cloudflare Workers
  mobile/    Expo、React Native
packages/
  api/       tRPCとZodの共有部分
  db/        Drizzle schema
  design-tokens/
```

ルートのworkspace設定は単純です。

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

`turbo.json`ではbuildとtypecheckの依存関係だけを管理しています。共有のために独自ビルド工程を増やすより、各packageがTypeScriptソースをexportする構成から始めました。

## 共有しているもの

最も効果が大きかったのはtRPCの型です。モバイルはWebの`AppRouter`を型importし、同じ入力と出力を使います。

```ts
import type { AppRouter } from "../../apps/web/src/server/api/root";

export const api = createTRPCReact<AppRouter>();
```

色、余白、文字サイズも`@squadnote/design-tokens`へ分けました。

```ts
export { colors } from "./colors";
export { spacing } from "./spacing";
export { radius } from "./radius";
```

待機列のような業務ルールは、ReactやDBへ依存しない純粋関数として共有候補になります。テストしやすく、Webとモバイルで結果がずれません。

## 共有していないもの

画面コンポーネントは共有していません。Next.jsのDOMとReact NativeのViewでは、見た目が似ていても操作、アクセシビリティ、レイアウトの制約が異なります。

認証情報の保存も別です。

- Web: NextAuthのCookieセッション
- Mobile: SecureStoreのBearer JWT

同じAPIへ到達しますが、ログイン画面やトークン保存まで共通化すると、各環境の都合を大量の分岐で抱えることになります。

ルーティングもNext.js App RouterとExpo Routerで実装を分けています。共有するのは`organizationId`や`scheduleId`といった意味であり、`router.push`を包む万能関数ではありません。

## 判断に使っている基準

コードをpackagesへ移す前に、次を確認します。

- DOM、React Native、Node、CloudflareのAPIへ依存していないか
- Webとモバイルで同じ変更理由を持つか
- propsを揃えるための分岐が増えていないか
- 単体テストだけで意味を確認できるか

業務ルールと型は、同じ変更理由を持ちやすい領域です。UIは同じ機能でも、端末ごとに変更理由が分かれます。

monorepoの利点は、すべてを共通化できることではありません。共有したい境界を後から動かせることです。まずアプリ内に実装し、重複よりも仕様のずれが問題になった時点でpackageへ切り出しています。
