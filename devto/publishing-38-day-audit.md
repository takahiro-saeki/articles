---
title: "Auditing 38 days of Qiita, Zenn, and dev.to records: scheduled does not mean published on time"
tags: writing, githubactions, productivity, javascript
canonical_url: https://zenn.dev/hirodeath/articles/publishing-38-day-audit
published: false
---

A schedule containing 38 rows does not prove that publication happened as planned for 38 days. Its row count stays the same if only the Japanese article is published, the English post fails, or a rerun recovers the pair later.

This repository retains daily schedule entries from August 3 through September 9, 2026. The initial article idea was about posting daily to Qiita, Zenn, and dev.to for 38 days. Checking what the data actually represents led to a different title.

Each Japanese article goes to either Qiita or Zenn, and its English translation goes to dev.to. This is not 38 posts on each of three platforms. Before reporting a count, reconcile the schedule, Japanese publication records, and English publication records.

## Pin the point in history

The source revision is `8a1bfa8` in `articles`. The inspection on September 11, 2026, covered the schedule, both languages' frontmatter, Git history, and GitHub Actions run records.

The audit ran on Node.js `v24.15.0`, reading files at the selected commit with `git show`. Adding drafts to the current working directory therefore does not change the historical dataset.

```bash
node experiments/article-stock-2026-09/audit-publishing.mjs 8a1bfa8
```

The [audit script](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/audit-publishing.mjs) resolves the Japanese and English file paths from that revision's schedule. It does not retrieve page views or reactions.

## Break the 38 entries down by date and platform

The results were:

| Metric | Result |
| --- | ---: |
| Schedule rows | 38 |
| Unique scheduled dates | 38 days |
| Inclusive span from first to last date | 38 days |
| Rows with Japanese articles on Zenn | 19 |
| Rows with Japanese articles on Qiita | 19 |
| Rows with Japanese publication metadata | 38 |
| Rows with an English published flag and post ID | 38 |
| English canonicals matching their Japanese counterpart | 38 |

The first date is August 3, 2026, and the last is September 9. The inclusive span matches the unique date count, so the schedule has one entry per day with no date gaps.

This checks publication records for 38 pairs, or 76 article files. The 38 Japanese articles split into 19 per platform; they were not all duplicated onto both Qiita and Zenn.

## Define recorded publication separately for each platform

The schedule alone cannot establish completion. The audit reads the Japanese and English files and follows the current publishing script's criteria.

For Zenn, `published: true` represents recorded publication. For Qiita, the audit requires `ignorePublish: false` and an `id` that is neither empty nor `null`. English posts require both `published: true` and `devto_id`.

```text
Scheduled date
  ├─ Japanese path → platform-specific publication metadata
  └─ English path  → published flag and devto_id
                     canonical matched to the Japanese counterpart
```

The existing publisher reads frontmatter line by line, and this historical audit follows that behavior. It is not a guarantee that every file is valid YAML. New drafts receive a separate YAML validation step.

For Zenn, the audit compares the canonical with the URL determined by the publishing account and slug. For Qiita, it uses the Japanese file's post ID and checks against `https://qiita.com/hiro123/items/<id>`. Similar titles alone do not establish that two files belong to the same article.

## Successful workflow runs are not a publication count

The scheduled workflow supports manual execution as well as scheduled runs. It can exit successfully without publishing anything when its metadata already indicates completion. Counting successful runs would therefore not count articles.

A manual run on August 4, 2026, actually failed with a dev.to 422 response about tags. Its log records rejection of tags containing spaces, such as `react native`. A subsequent commit introduced tag normalization.

References: [failed run](https://github.com/takahiro-saeki/articles/actions/runs/30867501704), [tag normalization change](https://github.com/takahiro-saeki/articles/commit/161138c)

The frontmatter inspected on September 11 includes recovery after that failure. Treating eventual publication as identical to first-attempt success would make the audit hide incidents.

Scheduled execution also cannot be assumed to start at the specified time. GitHub's [official documentation](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule) describes delays during high load and the possibility of dropped jobs. A target of publishing at the same time each morning requires a separate comparison with actual publication timestamps.

## What these results do not establish

The 38 matching records do not demonstrate:

- Reader access at exactly 09:00 every day.
- No need for manual recovery throughout the 38 days.
- Growth in views or followers caused by posting frequency.
- Correct rendering of every public page on every platform today.

A frontmatter ID records a publication result. This was not a full comparison with platform `published_at` values or current page rendering. An exact timing audit would retrieve the platforms' publication timestamps separately from scheduled dates and compare them.

Likewise, `updated_at` is an update timestamp, not necessarily the first publication timestamp. Edits and reruns can change what that date represents.

## Keep the pair as the unit of the next stockpile

The audit's unit is one Japanese article and one English translation. Following the schedule, both paths, and the canonical for each row exposes a missing half of a pair.

The next production cycle also separates completing drafts from adding them to a schedule. A finished draft does not increase the published count. It becomes part of the stockpile once both language versions are ready.

The precise result here is that 38 days of schedule entries exist, all 38 pairs retain publication metadata for both languages, and their canonicals match. Publication timing and reader response remain separate questions requiring different data.
