---
title: I built a Qiita trend analyzer to decide what technical article to write next
tags: qiita, node, api, javascript
published: false
---

_This article is an English translation of the original Japanese article._

## TL;DR

- After returning to technical writing, I wanted data rather than intuition to guide topic selection.
- I built a dependency-free tool of about 100 lines that uses only the Qiita API v2 to analyze tags and title patterns in recent high-rated articles.
- Repository: https://github.com/takahiro-saeki/qiita-trend-analyzer
- The results showed strong interest in practical AI articles, especially Claude Code, and list-style roundup titles.

## Why I built it

I had not posted on Qiita for about four years when I decided to start writing technical articles again.

The first problem was choosing what to write. Looking back at my older posts, the best performer combined a current topic with working code and reached 34 LGTM. Articles based mostly on my own attachment to a topic did not perform as well. Topic selection clearly mattered.

Instead of relying only on instinct, I wanted to retrieve what people were currently reading and use that data when choosing a subject.

## What the tool does

https://github.com/takahiro-saeki/qiita-trend-analyzer

```bash
# Analyze articles from the last seven days with at least five stocks
node analyze.mjs

# Change the date range and minimum stock count
node analyze.mjs --days 14 --min-stocks 10
```

It produces three reports:

1. Total LGTM by tag, showing which areas receive attention.
2. Frequency of title patterns such as "I tried", numbered lists, and introductions.
3. A list of articles with the most LGTM.

It uses the built-in `fetch` available in Node.js 18 and newer, with no package dependencies.

## Implementation details

### Qiita API v2 works without authentication

Article search queries can be sent without authentication. The unauthenticated limit is 60 requests per hour, while a token raises it to 1,000.

```js
const query = `created:>=${since} stocks:>=${MIN_STOCKS}`;
const url = `https://qiita.com/api/v2/items?page=${page}&per_page=100&query=${encodeURIComponent(query)}`;
const res = await fetch(url, { headers });
const items = await res.json();
```

Combining `created:>=date` with `stocks:>=count` narrows the data to recent articles that have crossed a minimum engagement threshold. A few API calls are enough to build the sample.

### Weight tags by total LGTM

Counting articles alone pushes high-volume tags to the top. I wanted to know how much engagement each tag's articles received, so the script sums `likes_count` for every tag.

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

### Count title patterns with regular expressions

Popular articles often use recognizable title formats. The script uses simple regular expressions to count which ones are still common.

```js
const patterns = [
  ["Tried it", /してみた/],
  ["Roundup or numbered list", /まとめ|\d+選/],
  ["Introduction or beginner", /入門|初心者/],
  // ...
];
```

The expressions analyze Japanese Qiita titles, so the labels above are English descriptions of the matched patterns.

## Results from late July 2026

I analyzed 75 articles created in the previous seven days with at least five stocks.

| # | Tag | Articles | Total LGTM |
|---|---|---|---|
| 1 | 初心者 (beginner) | 10 | 438 |
| 2 | Security | 6 | 404 |
| 3 | AI | 12 | 381 |
| 4 | 未経験エンジニア (new engineer) | 6 | 372 |
| 5 | 新人プログラマ応援 (support for new programmers) | 6 | 372 |
| 10 | ClaudeCode | 9 | 236 |

Several details stood out:

- AI had both a high article count and a high total LGTM. Claude Code had nine articles and 236 LGTM, which was efficient per article.
- The beginner and Security totals were heavily influenced by one roundup article about 138 sites for learning security, which received 330 LGTM. A successful roundup can dominate a tag.
- High-ranked posts included practical operational material such as collections of `CLAUDE.md` design patterns.

At that point in summer 2026, concrete accounts of using AI tools in real development were receiving attention on Qiita. A surface-level library introduction still had to compete with many similar posts.

## Trends are input, not a writing template

I use this analysis as a topic sensor, not as a reason to attach popular tags to thin articles. Qiita readers have become more critical of mass-produced articles that look AI-generated. Following a trend without original experience or verification can work against the author.

My current rule is to use data for choosing the subject, then fill the article with my own implementation, measurements, and mistakes.

## Closing note

I built the tool with Claude Code in about an hour. I also plan to write about the workflow that connects topic selection, drafting, and publication.
