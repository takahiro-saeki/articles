---
devto_id: 4720347
title: "When retrying scheduled publication avoids duplicates, and when a lost response breaks it"
tags: githubactions, javascript, writing, testing
canonical_url: https://zenn.dev/hirodeath/articles/scheduled-publishing-recovery-boundary
published: true
---

Whether it is safe to rerun a failed publishing command depends on where it failed. Retrying before an external service creates the article can attempt a new publication. Retrying after creation, when only the response was lost, can create another article.

This repository stores Qiita's `id` and dev.to's `devto_id` in the article files, then uses those IDs for updates on subsequent runs. That supports recovery when the IDs have been saved. It does not provide complete duplicate prevention.

The publisher at commit `8a1bfa8` was executed with external APIs and file operations mocked to establish that boundary. This article describes the implementation and a proposed recovery procedure for its remaining gap. It does not report an actual duplicate-publication incident.

## A saved ID turns the next attempt into an update

`scripts/publish-scheduled.mjs` reads the selected day's entry and handles Japanese publication before English. For Qiita, an existing `id` selects PATCH; otherwise it uses POST. For dev.to, `devto_id` selects PUT; otherwise it uses POST.

```text
POST to Qiita
  ↓ obtain id from the response
Save id in the Japanese file
  ↓
POST to dev.to
  ↓ obtain id from the response
Save devto_id in the English file
```

When both files have the required IDs and published flags, the script exits successfully without calling an API.

When only the Japanese side is complete, the behavior is slightly different. The current implementation runs the Qiita operation again, but uses PATCH because it has the ID. It then POSTs to dev.to, which still has no ID. Describing this as "retrying only the English post" would not match the code.

## Scheduled attempts and retries inside one job serve different purposes

The workflow schedules a start corresponding to 08:55 JST and another at 09:10. The earlier start waits until 09:00. Within a job, it tries the publisher up to 3 times, waiting 30 seconds and then 60 seconds after failures.

A retry within that job can reuse IDs already saved in its files. A separate run needs the changed frontmatter to have been committed to Git. The workflow has a metadata persistence step using `if: always()`, but that does not guarantee success if the step or its push fails.

A `concurrency` group also limits simultaneous publishing by workflows in that group. It does not make the external service's POST idempotent.

GitHub [documents delays under high load](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule). Adding another scheduled attempt does not guarantee publication at the desired time.

## Run the actual script without sending externally

The experiment ran on September 11, 2026, with Node.js `v24.15.0`. The [reproduction script](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/publishing-recovery.mjs) reads the publisher from Git, removes its two imports, and runs it in a VM. It supplies test replacements for file access, `fetch`, and environment variables.

```bash
node experiments/article-stock-2026-09/publishing-recovery.mjs
```

No real API requests are sent. The fake server increments its article count whenever it accepts a POST and can lose the response afterward. Fake files persist between attempts, exposing the difference between failing before and after an ID is saved.

| First attempt | Calls on retry | Final fake-server count: Qiita / dev.to |
| --- | --- | --- |
| Both posts accepted and IDs saved | None | 1 / 1 |
| Qiita ID saved, then dev.to returns 422 | Qiita PATCH, dev.to POST | 1 / 1 |
| Qiita accepts, then response is lost | Qiita POST, dev.to POST | 2 / 1 |
| dev.to accepts, then response is lost | Qiita PATCH, dev.to POST | 1 / 2 |
| Qiita accepts, then local persistence fails | Qiita POST, dev.to POST | 2 / 1 |

A separate dry-run check produced zero API calls and zero fake-server articles. Assertions verified all 6 cases.

This does not measure how often a real service loses a response. It checks which information the script has when choosing its next request. The fake server covers the Qiita and dev.to paths, not Zenn's Git integration or waiting inside actual GitHub jobs.

## Recover the ID before deciding to retry

The results support this proposed operational sequence:

1. Fix the target date and use dry-run to check the Japanese and English paths.
2. Inspect the failed run's log and the IDs saved in the files.
3. If a timeout or similar failure leaves acceptance uncertain, look for an existing post in the platform's article list or editor.
4. Once the matching post is identified, recover its actual ID and status before rerunning.
5. If creation cannot be established, stop automatic new POST attempts and continue investigating.

This is a proposed procedure for operating the existing script, not an implemented automatic reconciliation feature. Compare the body, target date, and canonical as well as the title. Never invent an ID.

Dry-run is available through this command, replacing the date with the one under investigation:

```bash
node scripts/publish-scheduled.mjs --date=2026-08-04 --dry-run
```

The reported publication state comes from local frontmatter. A successful dry-run does not establish that there are no externally created posts missing from local records.

## Start further automation at the persistence boundary

One possible improvement is to record states such as not sent, acceptance unresolved, and ID saved. An unresolved acceptance could prevent another automatic creation request. A reconciliation procedure would still be required.

The current implementation does not have this mechanism. More local state does not remove the interval in which the external service has created an article but its ID has been lost. Whether the service supports idempotent creation or a reliable way to locate the result needs separate investigation.

In the tested code, failures after the ID is saved can be retried as updates. Failures after external acceptance but before ID persistence can return to a new POST. Recovery should distinguish those cases instead of treating both as a single "failed" state.
