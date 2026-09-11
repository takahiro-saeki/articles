---
title: "Define shared acceptance criteria before adding every personal product to a Plane initiative"
published: false
description: "An initiative proposal starts with verified project mappings and a bounded notification-diagnostics objective."
tags: [plane, productivity, webdev, devops]
canonical_url: "https://zenn.dev/hirodeath/articles/plane-initiative-personal-products"
---

Putting personal products on one list can look like progress toward managing them together. But grouping a web service, a practice journal, and a game does not establish when the group is finished.

Before adopting an initiative, write the acceptance criteria shared by several products. Include only what those criteria require. Each project's ongoing progress can then be checked separately from completion of the shared objective.

This article uses notification implementations in SquadNote and Voices Diary to explore such a scope. The dedicated Initiatives feature was disabled in the personal Plane workspace on September 11, 2026. This is not an account of operating a created initiative.

## Match product names to actual Plane projects

The audit first read the complete project listing. Its five entries included SquadNote, but no dedicated project matching Voices Diary or VOLT NOMAD by name. A game project named SLABYRINTH identified `dungeon-roguelite` in its description.

| Subject | Verified management destination | Handling in this audit |
| --- | --- | --- |
| SquadNote | SQN Project | Existing work items and Git documents can be referenced |
| Voices Diary | No dedicated same-name project confirmed | Inspect the repository implementation first |
| VOLT NOMAD | No dedicated same-name project confirmed | Do not infer that another game's project is its destination |

Not finding a dedicated project does not prove that no work is tracked for that product. A shared project or other records may contain it. The narrower finding is that a candidate product name is insufficient to choose a destination ID.

With the dedicated feature disabled, the MCP response also suggested a work item type with the same name. That does not establish equivalent relationships or aggregation. A workspace feature and a ticket type need to be distinguished before deciding what can be connected.

## Derive a shared objective from two notification implementations

The [SquadNote notification specification](https://github.com/takahiro-saeki/circle-hub/blob/d116e8a343e8d9e7ddd3d1985efe590fa1901868/docs/multi-device-push.md) covers registration across devices, device-specific removal, and selecting delivery targets. The [Voices Diary administrator notification test specification](https://github.com/takahiro-saeki/voice-training-log/blob/6143bb99873ccf04b134dad4ac6b12c6e7a02d48/docs/17-remote-notification-test.md) covers administrator device registration, test sending, and inspection of tickets and receipts. The corresponding implementations were also read.

One possible shared objective is to make the progress of a verification notification traceable in both apps. This does not require standardizing the notification features themselves. Notifications for ordinary users and an administrator-only delivery-path test have different audiences and scope.

Acceptance criteria for that proposed objective can be made specific to each app.

| Target | What to verify for the shared objective | Evidence the existing documents cannot establish alone |
| --- | --- | --- |
| SquadNote | Identify the target registration and follow delivery selection without unregistering another device | Receipt observed on a verification device running the target version |
| Voices Diary | Register and send as an administrator, distinguishing ticket and receipt stages | Actual notification display and navigation after tapping it |

This table defines proposed acceptance criteria; it does not aggregate completed work. A successful server operation and a displayed notification should remain separate observations. No notifications were sent during this audit.

The inspected notification documents provide no reason to include VOLT NOMAD in this objective. A shared developer is not enough. The game can be considered when another objective requires it. Maintaining an inventory of all products and connecting products to a particular objective are different tasks.

## A progress percentage does not prove the objective is achieved

The [official Plane Initiatives documentation](https://docs.plane.so/core-concepts/projects/initiatives) describes related projects under a shared objective and allows work items to be added through Scope. The page displayed a Pro label and activation instructions when checked.

Connecting the entire SquadNote project to a notification objective also brings a project that contains unrelated work, such as invitations and introduction pages. Its overall completion rate cannot establish that notification diagnostics are ready.

In this proposal, projects identify the services under continuing maintenance, while the work and results required by the objective are explicit. If the available feature supports connecting relevant work items directly, that offers a way to narrow the scope. This audit did not test those UI operations or the aggregation formula.

Whichever arrangement is used, the final check returns to acceptance criteria. Receiving a notification in one app does not complete the objective while the other remains unverified. Conversely, unrelated backlog items can remain in both projects after the evidence for this objective is complete.

## Start by aligning criteria and references

Before enabling the dedicated feature, a small design note can define:

```text
Proposed objective: Make verification notifications traceable in two apps
Targets: SquadNote and Voices Diary
Excluded: Automated delivery to all users and game notification features
Acceptance: Record registration, delivery-path progress, and device results separately for each app
References: Relevant work items, fixed specification/implementation commits, verification results
Undecided: Voices Diary's management destination and adoption of dedicated Initiatives
```

This is a proposal prepared without changing existing projects, not the description of an initiative already created.

Until Voices Diary's destination is decided, it should not be automatically placed in a guessed project. If a project is created, first decide whether it is temporary notification work or the ongoing home for maintaining the service. Otherwise, routine maintenance after the objective ends still has no clear destination.

The audit verified project mappings, the disabled feature, and the notification scope of the two apps. It did not measure reduced search time or faster development across products. Here, the proposed initiative includes the apps needed to satisfy the notification-tracing criteria.
