---
devto_id: 4671333
title: "Keeping Codex decisions in the repository and checking them against implementation evidence"
tags: ai, git, documentation, gamedev
canonical_url: https://zenn.dev/hirodeath/articles/repository-decision-log-evidence
published: true
---

During a long production effort, finding an old proposal is only part of the problem. You also need to know whether it was adopted, remains a target, or was superseded.

VOLT NOMAD's production documents include a decision log, plans for individual phases, and a release-candidate audit. Reading them at the same Git revision separates targets from verification results. This provides a concrete way to establish the current situation without relying on the last statement in a chat.

The source is `events/2026-ai-browser-game-jam-4/` in `game-jam-lab`. Its documents and history at commit `f074703` were inspected on September 11, 2026. An earlier production article covered the overall process; this one asks whether the next person can reconstruct a particular decision.

## The original log records a choice and its reason

`CHARGE_CLICKER_PRODUCTION_PLAN.md` has a table of dates, decisions, and reasons. One entry dated August 2, 2026, chooses verification stages of 30 seconds, 5 minutes, and 20 minutes. Its stated reason is to avoid hiding a weak core loop behind more content.

When adding many features or assets becomes tempting, that entry provides the earlier criterion: establish that a short play session works first.

But the same table's targets of roughly 20 minutes for the normal ending and roughly one hour for the true ending remain targets. Being written down does not turn them into measurements.

| Document statement | What it establishes | What it does not establish |
| --- | --- | --- |
| A decision to verify in stages | The chosen verification approach at that time | Completion of every stage's tests |
| Targets of about 20 minutes and one hour | The intended experience duration at that time | A person's measured completion time |
| A date and reason | When and why the decision was made | That it remained unchanged afterward |

A decision history is not an automatically current status report.

## Check completion against later records

`PROJECT_CHARGE_POLISH_PLAN.md` in the same directory lists phase statuses such as implemented, music selection pending, and final QA in progress. Its stated update date is August 6.

`RELEASE_CANDIDATE_AUDIT_2026-08-12.md`, dated August 12, contains automated verification results. With the steady input model of 2 inputs per second, it records 15.58 minutes to the normal ending and 23.26 minutes for the complete route.

Comparing the original one-hour target with 23.26 minutes and declaring a major reduction would be premature. The latter uses automated input. The audit explicitly excludes time spent reading dialogue, understanding the interface, and comparing upgrades.

The relationship that can be reconstructed is:

```text
Production plan: target duration of a person's experience
Release-candidate audit: automated result under a fixed input model
Human playthrough: a separate verification step
```

The automated playthrough was not rerun for this investigation. These numbers come from the saved audit, not a new measurement.

## Fix a Git revision before reading across documents

Reading whatever happens to be in each working-directory file can mix in unfinished edits. For a technical explanation or article, pin the revision first.

```bash
git show f074703:events/2026-ai-browser-game-jam-4/docs/CHARGE_CLICKER_PRODUCTION_PLAN.md
git show f074703:events/2026-ai-browser-game-jam-4/docs/PROJECT_CHARGE_POLISH_PLAN.md
git show f074703:events/2026-ai-browser-game-jam-4/docs/RELEASE_CANDIDATE_AUDIT_2026-08-12.md
```

To investigate changes to a document, narrow the history to that file.

```bash
git log --oneline -- events/2026-ai-browser-game-jam-4/docs/CHARGE_CLICKER_PRODUCTION_PLAN.md
```

A commit date need not match a decision date in the document. Records can be added later. Check the text for the decision date and Git for changes to the record; neither should stand in for every event's timestamp.

The inspection confirmed that initial policy, intermediate phase status, and later audit results exist in separate documents. A "pending" status from August 6 cannot simply be copied into September's list of unfinished work.

## Label the kind of fact a new entry records

The existing decision log uses date, decision, and reason columns. A proposed extension would include status and evidence.

```markdown
## Decision: verify short play sessions first

- Status: adopted policy
- Decision date: 2026-08-02
- Reason: avoid hiding a weak core loop behind more content
- Evidence: decision log in CHARGE_CLICKER_PRODUCTION_PLAN.md
- Verification result: record separately from adoption of the policy
```

This example is derived from the existing record; the format has not already been adopted in the source files. Distinguishing a policy, implementation, and verification result does not require a new ADR management tool.

Silently replacing an old target with a new result also erases context. Preserve the previous target, the result under the current conditions, and the next question to check. A README or similar entry point can direct readers who only need the current policy to the current document.

## Keeping a chat is different from being able to resume work

A chat can preserve the nuance behind a choice. There is no need to discard it. But when the next necessary decision exists only halfway through a conversation, someone still has to establish which code revision it applies to.

Repository documents become stale too. These materials contain plans and audits from different dates. Their mere existence does not complete a handoff.

On resuming work, establish what was chosen, what was implemented, and under which conditions it was checked. Preserve the files and commits that answer those questions. Do not reinterpret a target as a measurement or an intermediate plan as the latest completion report. This provides enough evidence to choose the next check without rereading every chat.

Sources: [Production plan and decision log](https://github.com/takahiro-saeki/game-jam-lab/blob/f074703848586828b6a5acc0e465ccdd2c0d5244/events/2026-ai-browser-game-jam-4/docs/CHARGE_CLICKER_PRODUCTION_PLAN.md), [release-candidate audit](https://github.com/takahiro-saeki/game-jam-lab/blob/f074703848586828b6a5acc0e465ccdd2c0d5244/events/2026-ai-browser-game-jam-4/docs/RELEASE_CANDIDATE_AUDIT_2026-08-12.md)
