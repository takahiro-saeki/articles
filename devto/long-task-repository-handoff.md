---
title: "Resume a long Codex task by reconstructing progress from its evidence files"
published: false
tags: ai, git, productivity
canonical_url: null
---

A handoff saying "68 articles are done" is insufficient for resuming a long writing task. Of the 68 pairs with verified bodies, only 41 were complete with resolved URLs. The remaining 27 were waiting for canonical URLs, not for their bodies to be rewritten.

To preserve that distinction beyond the conversation, the production ledger, manuscripts, and verification records were read from the same commit. This article uses the actual repository to examine what a useful resumption record needs.

## Separate standing rules from progress at a particular moment

[OpenAI's AGENTS.md documentation](https://learn.chatgpt.com/docs/agent-configuration/agents-md) describes layering global and project instructions. It can hold continuing constraints such as avoiding publication and checking the personal account.

The current completed count and the next candidate to investigate are time-dependent information. Instead of filling AGENTS.md with every execution log, this workflow links the progress table to each batch's records. That is the file structure used for this production task, not a Codex feature that automatically resumes arbitrary progress JSON.

The examined snapshot is commit `6fe4649` on September 11, 2026. Its [production ledger](https://github.com/takahiro-saeki/articles/blob/6fe464919b7fba46d27395668d39d1e44b7f6964/production/2026-09/catalog.json) contains candidate IDs, Japanese and English paths, fact checks, verification, and status. The [progress table](https://github.com/takahiro-saeki/articles/blob/6fe464919b7fba46d27395668d39d1e44b7f6964/ARTICLE_PRODUCTION_STATUS_2026-09.md) is generated from that data.

## Establish the revision before using its counts

Start by checking uncommitted changes and the current commit in the working directory.

```sh
git status --short
git rev-parse HEAD
```

When verifying an older handoff, read the ledger at the explicit revision.

```sh
git show 6fe4649:production/2026-09/catalog.json
```

Recounting this snapshot reconstructed 90 candidates, 68 pairs with verified bodies, 41 completed pairs, 27 awaiting URLs, and 22 candidates still requiring body verification. Both language files were also confirmed to exist at that commit.

Those counts belong to that snapshot. Recalculate when later commits contain more work. A difference from an old note does not immediately imply corruption or a need to repeat the work.

## Preserve routes to the evidence behind each count

A handoff JSON example was prepared with the following information:

| Record | Purpose |
| --- | --- |
| Base commit and branch | Identify the work state |
| Body-verified, completed, URL-pending, and remaining counts | Avoid collapsing different states into "done" |
| Paths and SHAs for 6 evidence files | Detect missing or replaced records |
| Unresolved issue | Prevent unauthorized publication just to obtain a URL |
| Next candidate IDs and resumption checks | Avoid regenerating existing manuscripts |

The 6 evidence files are the ledger, progress table, previous batch review, Humanizer audit, body validation, and canonical completion gate. The [handoff example](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/production/2026-09/batch-12/handoff-example.json) is a new proposal produced during this investigation, not a previously installed record.

It does not treat a stored "running" string as proof of a live process. If a process or job exists, query its handle in the current environment and distinguish completed, running, and unknown before deciding how to continue. These file checks cannot establish whether an external job is alive.

## Check whether stale or missing records are accepted

The Python verification covers the matching fixed snapshot plus 4 altered handoff or read-result conditions.

| Condition | Result |
| --- | --- |
| Base commit, counts, and evidence match | No mismatch |
| Different commit specified | Revision mismatch detected |
| 68 body-verified pairs recorded as 68 completed pairs | Count mismatch detected |
| Canonical verification evidence missing | Missing evidence detected |
| Evidence content changed | SHA mismatch detected |

Testing only the matching case could miss a readable but stale file. The altered cases check whether a deliberate discrepancy stops verification. No files were deleted from the source repository, and no historical commit was rewritten.

SHA agreement identifies the recorded content; its technical claims still require review. A JSON report saying success is also insufficient by itself. For a conclusion needed during resumption, follow the review record to what was executed and whether it corresponds to the manuscript revision.

## Choose a specific first action after resumption

Starting from this record, inspect the current worktree against the base commit and identify unstarted candidates. There is no need to move the 27 URL-pending pairs back into the new-writing queue or delete existing manuscripts merely because they are not complete.

The [reconstruction and 5-condition verifier](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/audit-production-batch12.py) reads fixed Git data. This checks the handoff format; it is not a comparison where Codex was restarted in a separate session and ran the whole task to completion. Time savings and reductions in forgotten work were not measured. The verified scope is whether a resuming worker can revisit the evidence and select the remaining work.
