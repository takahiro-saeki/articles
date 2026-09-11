---
title: "Before turning AI chats into a devlog, verify the numbers and completion claims"
published: false
tags: [ai, gamedev, documentation, testing]
canonical_url: https://zenn.dev/hirodeath/articles/devlog-primary-source-reconstruction
---

Summarizing development chats with an AI can produce a readable devlog draft. But conversational statements such as “implemented,” “verified,” and “everything passed” are not ready-made facts for publication. A proposal, added code, a passing test, and an actual playthrough are different events.

Before moving a sentence into a devlog, identify its claim and return to the material that can support it. This article uses a draft devlog and verification code from VOLT NOMAD, focusing on what numbers count and what completion actually means.

The investigation took place on September 11, 2026, against `game-jam-lab` commit `f074703`. It is not a complete reconciliation of several chat histories. It demonstrates a verification procedure that also applies when turning chat summaries into publishable prose.

## Read the draft as a list of claims

The [devlog draft](https://github.com/takahiro-saeki/game-jam-lab/blob/f074703848586828b6a5acc0e465ccdd2c0d5244/events/2026-ai-browser-game-jam-4/docs/DEVLOG_DRAFT.md) discusses route-order checks, bilingual story text, and final verification. Its opening explicitly says that final playthrough results should be added before publication.

The end still has fields for time to the normal ending, time for the complete route, final fixes, and the release-candidate date. That document cannot be cited as a finished, published retrospective.

Temporarily set aside the narrative and break it into claims:

| Claim to investigate | Source to revisit | Distinction needed for the article |
| --- | --- | --- |
| Route orders were checked across 1,440 cases | Test code and audit document | State-transition cases or human playthroughs? |
| There are 33 bilingual story events | Catalog and its checks | Field presence or translation quality? |
| Final verification is complete and publication can proceed | Remaining draft fields and release records | Planned work or recorded results? |

If a chat contains a completion report, add it to this list first. Polishing its wording comes later.

## What does “1,440 cases” count?

The `audit_every_hunt_order` function in the [release audit code](https://github.com/takahiro-saeki/game-jam-lab/blob/f074703848586828b6a5acc0e465ccdd2c0d5244/events/2026-ai-browser-game-jam-4/godot/tests/release_audit.gd) generates permutations of the stage order and varies the first boss selected for each one.

The catalog contains 6 stages and 2 normal bosses. That gives `6! = 720` orders, multiplied by the first-boss choice: `720 × 2 = 1,440` cases.

The following JavaScript illustrates the count with symbolic names instead of the actual catalog entries:

```js
function permutations(items) {
  if (items.length === 0) return [[]];
  return items.flatMap((item, i) =>
    permutations(items.filter((_, j) => i !== j))
      .map(rest => [item, ...rest])
  );
}

const orders = permutations(["A", "B", "C", "D", "E", "F"]);
const cases = orders.flatMap(order =>
  ["boss-a", "boss-b"].map(firstBoss => ({ order, firstBoss }))
);
console.log(orders.length, cases.length);
// 720 1440
```

The [verification script for this investigation](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/game-submission-evidence.mjs) extracts the actual IDs from the fixed commit and confirms 1,440 unique combinations. It ran on Node.js `v24.15.0`.

Recomputing the count is not the same as rerunning the Godot audit. It verifies the origin of the number and the number of combinations.

## After reading the test name, inspect the calls

For each case, the audit creates a new route-management object and calls methods to select and complete stages, defeat bosses, and continue into later routes. It checks intermediate states and restoration from a save snapshot.

Completing a stage here does not mean opening the game and playing until an enemy's HP is depleted. The test calls the route manager's completion method and examines the resulting state.

A supported sentence for the devlog would therefore be:

> The audit code is structured to check route-state transitions across 1,440 cases combining stage order and the first boss selection.

Writing “1,440 full playthroughs confirmed that the entire game works” would expand the claim beyond the test. Rendering, input feel, combat behavior, and actual playtime are not established by that loop.

The same applies to the 33 story events. The code checks their count and fields such as Japanese and English text. Those assertions do not establish natural prose or translation quality. A presence check should remain a presence check in the article.

## Preserve uncertainty when documents describe different moments

The [release-candidate audit document](https://github.com/takahiro-saeki/game-jam-lab/blob/f074703848586828b6a5acc0e465ccdd2c0d5244/events/2026-ai-browser-game-jam-4/docs/RELEASE_CANDIDATE_AUDIT_2026-08-12.md) records automated checks and browser checks from that time. The devlog draft still has fields for manual playthrough results.

Do not resolve that difference by selecting the more convenient document. Read the scope of the recorded audit and the checks still requested by the draft separately. This investigation did not perform a fresh playthrough or test the public game page, so it adds no current results for those activities.

For each claim retained in the reconstructed account, keep a small record:

```text
Claim: stage order and first-boss selection produce 1,440 cases
Evidence: catalog and audit code at the fixed commit
Checked now: independently recomputed the combination count
Outside this check: running the Godot audit, playthroughs, elapsed playtime
Article wording: describe the number as state-transition test cases
```

That record makes it possible to check whether shortening a sentence during editing accidentally turned an excluded activity into a completed achievement.

## Rebuild the narrative from supported claims

After verification, organize the article around the reader's questions rather than the order of the chats. This example need not start by emphasizing a large number. It can explain which transitions should not be missed, how combinations were constructed, and what still needs separate verification.

Keep undocumented feelings and manual activities out of the first-person account. Code and test names cannot establish an experience such as repeatedly playing the game and feeling that it had improved.

When asking an AI to organize the draft, supply the verified claims, sources, and unverified scope together. For the number 1,440, that can include an explicit instruction not to rewrite it as a count of full playthroughs. Making prose natural and broadening what the evidence supports remain separate operations.
