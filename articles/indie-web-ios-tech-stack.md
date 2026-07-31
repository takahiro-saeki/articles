---
title: "個人開発でWeb+iOSアプリを2本運用している技術スタックを全部書く"
emoji: "🧱"
type: "tech"
topics: ["nextjs", "expo", "cloudflare", "trpc", "個人開発"]
published: false
---

Web(ブラウザ)とiOSアプリの両方を持つサービスを、1人で2本開発・運用しています。サークル運営の管理サービスと、ボイストレーニングの記録アプリです。

2本目では、1本目で使った構成の一部を流用できました。認証やデプロイにはまだプロジェクト固有の調整が残っていますが、最初から選び直す項目は減っています。この記事では、現在使っている構成と未整理の部分をレイヤーごとに書きます。

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

APIサーバーは分離せず、Next.jsの `/api/trpc` をExpoアプリから呼び出します。`packages/api` はルーターの型をre-exportするための小さなパッケージです。ただし、プロジェクトによっては暫定的にWeb側の `AppRouter` を直接参照している箇所も残っています。型共有の方向性は揃っていますが、パッケージ境界はまだ整理中です。

選定理由は単純で、1人でWebとアプリの両方を書くと、APIの型定義を2箇所でメンテする時間が一番無駄だからです。REST + OpenAPIのコード生成も検討しましたが、生成ステップが無いぶんtRPCの方が個人開発向きでした。

## 認証: NextAuth v5 + モバイルはJWT

WebはNextAuthのセッションCookie(Google / Apple OAuth)。モバイルはCookieと相性が悪いので、OAuth完了時にJWTを発行してExpoのSecureStoreに保存し、以降はBearerヘッダーで認証します。サーバー側は「Cookieセッション or Bearer」の二刀流コンテキストです。

正直、このスタックで一番設計に時間を使った場所です。逆に言えば、ここさえ作れば残りは素直に書けます。

## DB: Drizzle + D1

DBはCloudflare D1(SQLite互換)、ORMはDrizzleです。この組み合わせの気に入っている点は2つあります。

- Drizzleのrelational queriesを使うと、関連データをまとめて取得するSQLを組み立てやすい
- drizzle-kitのマイグレーションとD1のマイグレーション運用が素直に噛み合う(ローカルと本番に同じSQLを適用できる)

制約もあります。D1には対話的なトランザクションがなく、複数文は `batch()` で扱います。PRAGMAにも制限があります。SQLiteの感覚のまま書くと引っかかりますが、現在のCRUD中心の機能では大きな問題にはなっていません。

## UI: Tailwind v4 + Base UI(Web)、design-tokens(共通)

メインの1本のWebはshadcn/uiに近い構成です。コンポーネントを自分のリポジトリに置き、cvaでバリアントを管理し、プリミティブ層にBase UIを使っています。もう1本は素のTailwindを中心にした簡略構成です。UI層はプロジェクトの規模に合わせて変えています。

Webとアプリでは、色・余白・フォントの名前をデザイントークンで揃えています。アプリはStyleSheetへ直接importし、Webは同じ値をCSS変数に定義します。Web側は手動同期なので完全な一元管理ではありませんが、画面ごとに色を選び直す場面は減りました。

## テスト: ストーリー=テスト

テストはVitestで、ロジックのunitテストに加えて、**Storybookのストーリーがそのままbrowser mode(実Chromium)のテストとして走る**構成にしています。カタログを書く行為とテストを書く行為が一致するので、1人開発でもテストが自然に増えます。

## インフラ: Cloudflareにほぼ全部乗せ

- Next.jsは@opennextjs/cloudflareで**Workers**にデプロイ
- DBはD1、アセットはWorkersの静的アセット配信
- 環境はprod / devの2系統(D1もデプロイ先も分離)

選定理由はコストと運用の軽さです。現在の利用量はWorkersとD1の無料枠に収まっています。自分でサーバーを管理する作業がないため、運用に割く時間を抑えられています。

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
