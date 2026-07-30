---
title: "個人開発でWeb+iOSアプリを2本運用している技術スタックを全部書く"
emoji: "🧱"
type: "tech"
topics: ["nextjs", "expo", "cloudflare", "trpc", "個人開発"]
published: false
---

Web(ブラウザ)とiOSアプリの両方を持つサービスを、1人で2本開発・運用しています。サークル運営の管理サービスと、ボイストレーニングの記録アプリです。

2本目を作るときに1本目の構成をそのまま流用したところ、立ち上げが劇的に楽になりました。つまりこのスタックは私にとって「再利用実績のあるテンプレート」になっています。何をどう選んだか、レイヤーごとに全部書きます。

## 全体像

```
├── apps/
│   ├── web/      Next.js 15 (App Router) + React 19
│   └── mobile/   Expo SDK 54 (React Native 0.81)
└── packages/
    ├── api/            tRPCのAppRouter型を共有
    └── design-tokens/  色・余白・フォントの定数
```

- モノレポ: **Turborepo + pnpm workspace**
- API: **tRPC v11**(ルーター実体はNext.js内、モバイルは型だけ共有)
- 認証: **NextAuth v5(beta)**+ モバイル用にJWTの橋渡し
- DB: **Drizzle ORM + Cloudflare D1**
- UI(Web): **Tailwind CSS v4 + shadcn/uiスタイル + Base UI(@base-ui/react)**
- UI(Mobile): React Native StyleSheet + design-tokens
- テスト: **Vitest**(unit + Storybookのbrowser modeテスト)
- インフラ: **Cloudflare Workers(@opennextjs/cloudflare)**

## API: tRPC v11で「型の二重管理」を消す

このスタックの背骨です。APIサーバーは分離せず、Next.jsの `/api/trpc` がそのまま本番APIで、Expoアプリは外からそこを叩きます。`packages/api` はルーターの**型だけ**をre-exportする軽いパッケージで、サーバーのprocedureを変えるとモバイル側のコードに即座に型エラーが出ます。

選定理由は単純で、1人でWebとアプリの両方を書くと、APIの型定義を2箇所でメンテする時間が一番無駄だからです。REST + OpenAPIのコード生成も検討しましたが、生成ステップが無いぶんtRPCの方が個人開発向きでした。

## 認証: NextAuth v5 + モバイルはJWT

WebはNextAuthのセッションCookie(Google / Apple OAuth)。モバイルはCookieと相性が悪いので、OAuth完了時にJWTを発行してExpoのSecureStoreに保存し、以降はBearerヘッダーで認証します。サーバー側は「Cookieセッション or Bearer」の二刀流コンテキストです。

正直、このスタックで一番設計に時間を使った場所です。逆に言えば、ここさえ作れば残りは素直に書けます。

## DB: Drizzle + D1

DBはCloudflare D1(SQLite互換)、ORMはDrizzleです。この組み合わせの気に入っている点は2つあります。

- Drizzleのrelational queriesは何段ネストしても1クエリのSQLに変換されるので、クエリ回数がレイテンシに直結するD1と相性が良い
- drizzle-kitのマイグレーションとD1のマイグレーション運用が素直に噛み合う(ローカルと本番に同じSQLを適用できる)

制約もあります。D1には対話的なトランザクションが無い(`batch()` で書く)、PRAGMAは触れない、あたりはSQLiteの感覚のままだと引っかかります。個人開発のCRUD規模なら実害はほぼありませんでした。

## UI: Tailwind v4 + Base UI(Web)、design-tokens(共通)

メインの1本のWebは shadcn/uiスタイル(コンポーネントを自分のリポジトリに所有し、cvaでバリアント管理)で、プリミティブ層だけRadixではなく**Base UI**を使っています(もう1本はUI層を素のTailwindだけの簡略構成にしています。ここは規模に応じて足し引きするレイヤーです)。Radixを作ったメンバーの新しいheadlessライブラリで、書き味はRadixのまま、型とdata属性が今風に整理されています。

WebとアプリのデザインはNPMパッケージ化した**デザイントークン**(色・余白・フォントのTS定数)で揃えます。WebはCSS変数として同値を定義、アプリはStyleSheetに直接import。「Webとアプリで微妙に色が違う」が構造的に起きなくなります。

## テスト: ストーリー=テスト

テストはVitestで、ロジックのunitテストに加えて、**Storybookのストーリーがそのままbrowser mode(実Chromium)のテストとして走る**構成にしています。カタログを書く行為とテストを書く行為が一致するので、1人開発でもテストが自然に増えます。

## インフラ: Cloudflareにほぼ全部乗せ

- Next.jsは@opennextjs/cloudflareで**Workers**にデプロイ
- DBはD1、アセットはWorkersの静的アセット配信
- 環境はprod / devの2系統(D1もデプロイ先も分離)

選定理由はコストと運用の軽さです。個人開発の規模だと、Workers + D1は無料枠に収まります。サーバーの面倒を見る作業が存在しないので、運用の時間はほぼゼロです。

デプロイはこれだけです。

```bash
opennextjs-cloudflare build && wrangler deploy
```

モバイル側はExpoの標準的なビルド〜App Store申請の流れです。

## このスタックの弱点も書いておく

- **NextAuth v5はまだbeta**です。破壊的変更のリスクを受け入れています
- **D1の情報はまだ少ない**。ハマったときに検索で答えが出ないことがあり、公式ドキュメントとソースを読む前提です
- **モバイルの審査サイクル**だけはスタックで解決できません。Webはデプロイすればいいがアプリはストア審査を挟むので、APIの後方互換を守る規律が必要です

## まとめ: 2本目が楽になるスタックが良いスタック

このスタックの評価軸は「1本目を最速で作れるか」ではなく「**2本目を作るときにどれだけ流用できるか**」でした。monorepoの形、認証の橋渡し、トークン、デプロイ手順。この辺りが全部テンプレートとして持ち越せたので、2本目は本質的な機能開発から始められました。

個別の要素(tRPCの型共有、D1移行、Base UIなど)はそれぞれ別記事で詳しく書いているので、興味のあるレイヤーがあればそちらもどうぞ。

## 環境まとめ

- Turborepo + pnpm / Next.js 15 + React 19 / Expo SDK 54(RN 0.81)
- tRPC v11 + TanStack Query v5 + superjson / NextAuth v5 beta + jose
- Drizzle ORM 0.41 + Cloudflare D1 / Tailwind CSS v4 + @base-ui/react + cva
- Vitest + Storybook(nextjs-vite)+ Playwright / @opennextjs/cloudflare + wrangler
