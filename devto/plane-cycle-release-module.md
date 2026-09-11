---
title: "Carrying unfinished work between Plane cycles without closing the release"
published: false
description: "A proposed weekly workflow uses actual acceptance criteria to separate development completion from distribution."
tags: [plane, productivity, webdev, devops]
canonical_url: "https://zenn.dev/hirodeath/articles/plane-cycle-release-module"
---

The implementation is ready at the end of the week, but mobile verification remains. Marking the work item Done just to close the weekly cycle would make that unfinished verification look complete.

At the weekly boundary, preserve the work item's actual state and decide what to carry forward. A release module should retain the conditions for delivering its output. The end of a week and readiness to distribute a feature need separate states.

The example is SquadNote's trial-participant feature. A read-only Plane inspection on September 11, 2026 found zero non-archived cycles and zero modules. The following is a proposed workflow built from real acceptance criteria and verification records, not a report of an established weekly process. No Plane settings or work states were changed.

## The remaining work was mobile verification

`SQN-30` covers trial-participant permissions, invitation URL compatibility, promotion to full membership, and ending a trial. Its acceptance conditions require consistent behavior on web, iOS, and Android. The ticket covers the development environment and automated tests; production rollout is explicitly outside its scope.

The [verification document](https://github.com/takahiro-saeki/circle-hub/blob/d116e8a343e8d9e7ddd3d1985efe590fa1901868/docs/testing/sqn-30-trial-participant-checklist.md) at fixed commit `d116e8a` contains completed web checks and unfinished mobile checks. Some mobile checks are marked complete, but the final item confirming completion of mobile verification remains unchecked.

The next plan does not need to repeat the entire implementation. It needs to preserve the verified version and results, then identify what remains unchecked on which device. This article did not rerun those application checks.

## Keep one work item for the work itself

According to [Plane's cycle documentation](https://docs.plane.so/core-concepts/cycles), unfinished work items retain their state when a cycle ends and can be transferred to another cycle. A work item can belong to only one cycle at a time. The [module documentation](https://docs.plane.so/core-concepts/modules) allows a work item to belong to multiple modules, such as a feature module and a release module.

Keep one work item and relate it to the relevant period and deliverable. There is no need to create two identically named tickets solely for weekly and release tracking.

However, putting only `SQN-30` in a release module would leave a gap. Done on that ticket does not include production distribution. Tracking the release requires separate work for distribution and verification afterward.

```text
Proposed arrangement

Work item: SQN-30
  Scope: Trial-participant implementation and acceptance in development
  Weekly membership: This cycle → next cycle if needed

Proposed additional work: Distribution and post-distribution verification
  Scope: Define targets and procedure, then record results for the target version

Release module
  Related work: SQN-30 and the distribution/verification task
  Acceptance: Distribution to the agreed targets and completion of required checks
```

The additional task has no Plane ID because it has not been created. It remains a proposal.

## Carry the reason for unfinished work into the next plan

Applying the current verification record to a hypothetical weekly review produces the following decisions. This is a walkthrough, not the result of operating the process for two weeks.

| Decision point | SQN-30 | Weekly handling | Release handling |
| --- | --- | --- | --- |
| End of week 1, with mobile checks remaining | Keep unfinished | Close the week and select checks that can be performed next week | Incomplete |
| End of week 2, if development acceptance is satisfied | Can be Done | Record completion in that week | Incomplete while distribution work remains |
| After distribution and target-version checks | Keep Done | Record distribution results in the relevant week | Compare against module acceptance before completing it |

Repeatedly extending the first week would obscure what was accomplished within the original period. Closing that period and selecting remaining work again gives the plan and outcome a stable boundary for comparison.

Carryover should also include a reason. Here, it could say that mobile permission displays and access restrictions remain to be checked, with the web results linked at a fixed commit. Confirm that the required devices will be available in the next week. Transferring everything, including work that cannot be performed then, turns the next plan into storage.

## Preserve the agreed scope when deciding completion

Removing acceptance conditions merely because verification missed a date changes the intended deliverable. Adding store distribution to a development-only ticket creates the opposite problem: work satisfying the original scope can no longer close.

If scope must change, record what moves to another release and how the current acceptance conditions change. Preserve a reason for work removed from a module too. Simply unlinking it makes the original plan indistinguishable from a plan that never included it.

In this example, development acceptance and production rollout were separate from the beginning. Keeping that distinction allows `SQN-30` to close when appropriate while leaving release preparation visible.

## Do not change the facts to tidy the first weekly report

The evidence here consists of existing ticket scope, a fixed verification document, and official behavior. It does not include a live cycle transfer experiment or measurements of module progress displays.

An initial adoption could use one feature to check whether unfinished work remains identifiable as it moves into the next plan. Then check whether development completion and distribution completion can be read separately. For this case, record why the work remains and which device or behavior needs checking next.
