---
title: 「次に何を書くか」をデータで決める。Qiita APIでトレンド分析ツールを作った
tags:
  - Qiita
  - QiitaAPI
  - Node.js
  - JavaScript
  - トレンド
private: false
updated_at: ''
id: null
organization_url_name: null
slide: false
ignorePublish: true
posting_campaign_uuid: null
agreed_posting_campaign_term: false
---

## TL;DR

- 技術記事を再開するにあたり、「何を書くか」を感覚ではなくデータで決めたくなった
- Qiita API v2 だけで、直近の高評価記事のタグ・タイトル傾向を分析するツールを作った(依存パッケージゼロ、約100行)
- リポジトリ: https://github.com/takahiro-saeki/qiita-trend-analyzer
- 分析してわかったこと: **AI系(特にClaude Code)の実践記事**と**「まとめ・◯選」型**が現在のQiitaでは強い

## 動機

4年ほどQiitaへの投稿が止まっていたのですが、技術発信を再開することにしました。

再開して最初に悩むのが「何を書けばいいのか」です。過去の自分の記事を見返すと、伸びたのは時事ネタ×実践コードの記事(最高34LGTM)で、逆に思い入れだけで書いた記事は伸びていませんでした。つまりテーマ選定が半分以上を決めている。

であれば、テーマ選定を感覚でやるのはやめて、**いま実際に何が読まれているかをAPIで取得して判断材料にしよう**というのがこのツールです。

## 作ったもの

https://github.com/takahiro-saeki/qiita-trend-analyzer

```bash
# 直近7日 / ストック5以上の記事を分析
node analyze.mjs

# 期間と足切りラインは変更可能
node analyze.mjs --days 14 --min-stocks 10
```

やっていることは3つだけです。

1. **タグ別の獲得LGTM合計**: いま読まれているジャンル
2. **タイトルの型の出現頻度**: 「〜してみた」「◯選」「入門」など
3. **LGTM上位記事の一覧**: 実際に伸びた記事

Node.js 18+ の標準機能(`fetch`)のみで、依存パッケージはありません。

## 実装のポイント

### Qiita API v2 は認証なしで使える

検索クエリ付きの記事取得は認証なしで叩けます(レート制限は60回/h、トークンを渡せば1000回/h)。

```js
const query = `created:>=${since} stocks:>=${MIN_STOCKS}`;
const url = `https://qiita.com/api/v2/items?page=${page}&per_page=100&query=${encodeURIComponent(query)}`;
const res = await fetch(url, { headers });
const items = await res.json();
```

ポイントは検索クエリで `created:>=日付` と `stocks:>=数` を組み合わせているところです。「最近作られて、かつ一定以上ストックされた記事」だけに絞ることで、APIを数回叩くだけでトレンドの母集団が手に入ります。

### タグはLGTM合計で重み付けする

単純な記事数だと、投稿数が多いだけのタグが上位に来てしまいます。「そのタグの記事が実際にどれだけ評価されたか」を見たいので、タグごとに `likes_count` を合計しています。

```js
const tagStats = new Map();
for (const it of items) {
  for (const t of it.tags) {
    const key = t.name.toLowerCase();
    const s = tagStats.get(key) ?? { name: t.name, count: 0, likes: 0 };
    s.count += 1;
    s.likes += it.likes_count;
    tagStats.set(key, s);
  }
}
```

### タイトルの「型」を正規表現で数える

伸びる記事はタイトルに型があります。どの型が現役なのかを、雑にですが正規表現で数えています。

```js
const patterns = [
  ["「〜してみた」", /してみた/],
  ["「まとめ・選」", /まとめ|\d+選/],
  ["「入門・初心者」", /入門|初心者/],
  // ...
];
```

## 分析結果(2026年7月末時点)

直近7日・ストック5以上の75記事を分析した結果がこちらです。

| # | タグ | 記事数 | LGTM合計 |
|---|---|---|---|
| 1 | 初心者 | 10 | 438 |
| 2 | Security | 6 | 404 |
| 3 | AI | 12 | 381 |
| 4 | 未経験エンジニア | 6 | 372 |
| 5 | 新人プログラマ応援 | 6 | 372 |
| 10 | ClaudeCode | 9 | 236 |

読み取れることはいくつかあります。

- **AI系が記事数・LGTMともに最大勢力**。特にClaude Code関連は9本で236LGTMと、1本あたりの効率が高い
- 1位の「初心者」やSecurityの数字は「セキュリティの勉強になるサイト138選」(330LGTM)という**まとめ型の大ヒット1本**が引っ張っている。まとめ・◯選型は当たると大きい
- 上位記事には「CLAUDE.md 設計パターン集」のような、**AIツールの実運用ノウハウ**が並ぶ

つまり2026年夏のQiitaは「AIツールを実務でどう使い込むか」を具体的に書けば読まれる状況です。逆に、ライブラリの表面的な紹介だけでは埋もれます。

## 注意: トレンドは「センサー」であって「テンプレ」ではない

最後に自戒を込めて。この手の分析は**テーマ選定のセンサー**として使うものであって、トレンドタグに乗って薄い記事を量産するためのものではありません。最近のQiitaはAI生成っぽい量産記事への風当たりが強く、中身のない便乗記事はLGTMがつかないどころか逆効果です。

「何を書くか」はデータで決めて、「中身」は自分の実体験と検証で埋める。この分担が健全だと思っています。

## おわりに

このツール自体、Claude Codeと一緒に1時間ほどで作りました。テーマ選定→執筆→公開のワークフロー全体もいずれ記事にする予定です。

再開一発目の記事なので、お手柔らかにお願いします。
