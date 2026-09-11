---
title: "A bilingual article\u2019s canonical URL changes from a draft decision to an API result"
published: false
tags: writing, javascript, discuss
canonical_url: null
---

Before a Japanese Qiita article has been created, its English counterpart lacks the article ID needed for its canonical URL. This repository constructs a planned Zenn URL from the slug and uses the publishing API's response URL for Qiita. Manuscripts and their URLs become ready at different stages.

I/O was replaced with in-memory files and API mocks to inspect where the existing scripts obtain and store the URL. No external draft or published article was created.

## Keep planned URLs and response URLs distinct

The subject is the [scheduled publishing script](https://github.com/takahiro-saeki/articles/blob/6fe464919b7fba46d27395668d39d1e44b7f6964/scripts/publish-scheduled.mjs) at commit `6fe4649` in `articles`. It was inspected on September 11, 2026, and tested with Node.js 24.15.0.

| Japanese platform | Canonical source | Resolution condition |
| --- | --- | --- |
| Zenn | Publishing account and file slug | Fix the account and slug |
| Qiita | `result.url` returned by the create/update API | Receive the corresponding successful API response |

[Qiita API v2](https://qiita.com/api/v2/docs) accepts content and a title when creating an article; its response includes an article `id` and `url`. This implementation does not convert the local filename into a Qiita article ID.

A planned Zenn URL also does not prove that the page has been published. Here it identifies the intended destination for an unpublished manuscript.

## The scheduled script passes the Japanese result to the English article

In the Qiita branch, a successful response causes the script to write the ID and other metadata back to the Japanese file and pass the response URL to dev.to. The outgoing dev.to payload and the English frontmatter use the same URL.

```text
Qiita response.url
  -> dev.to payload.article.canonical_url
  -> English frontmatter canonical_url
```

[Forem's official specification](https://developers.forem.com/api/v1) uses `canonical_url` for the original URL of an article published elsewhere. API support for null does not establish the relationship between the Japanese and English articles.

The mocked runs produced these results:

| Condition | Result |
| --- | --- |
| English canonical is null | Replaced with the Qiita response URL |
| English file retains an old Zenn URL | Also replaced with the Qiita response URL |
| Qiita returns 422 | No dev.to call and no file writes |
| Japanese platform is Zenn | URL constructed from the Japanese file's slug |
| dry-run | No API calls or writes |

The successful responses used synthetic data. Real Qiita page availability and dev.to canonical display were not checked.

## The standalone dev.to script turns null into a string

The other entry point, the [standalone publishing script](https://github.com/takahiro-saeki/articles/blob/6fe464919b7fba46d27395668d39d1e44b7f6964/scripts/publish-devto.mjs), reads frontmatter with a regular expression on each line. It is not a YAML parser.

Consider this English frontmatter:

```yaml
published: false
canonical_url: null
```

The parser extracts the string `"null"`, not JavaScript's `null`. Because the string is nonempty, it passes the condition for including a canonical value. Running the actual code with mocks confirmed that the outgoing payload also contained the string `"null"`.

For this entry point, `published: false` requests an external dev.to draft; it does not disable communication. The scheduled script's normal path performs publication, so existing draft flags alone do not prevent that call either.

Neither real script was started with real credentials during this investigation, and nothing was added to the schedule. Handling null in the standalone entry point and rejecting unresolved URLs before sending remain proposed improvements.

## Preserve unresolved status in the production ledger

This workflow does not create an external article solely to obtain a future Qiita ID. Until an ID exists, `canonical_url: null` is a local marker for an unresolved English draft. Even after its body has passed verification, that pair is excluded from the completed count.

That marker is not a value approved for API submission. In a separate stage where publishing is authorized, the corresponding Japanese URL must be resolved and compared across the English payload, saved frontmatter, and publishing response.

The [reproduction code for 6 cases](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/canonical-lifecycle-batch12.mjs) reads the original code from the fixed commit and replaces only I/O. It checks URL propagation, without measuring search-ranking effects or real service acceptance. This production workflow leaves an unresolved URL unresolved instead of filling it with a plausible-looking address.
