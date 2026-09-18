---
devto_id: 4680417
title: "Choosing Plane Projects, Modules, Cycles, and Initiatives by what needs to be finished"
tags: productivity, opensource, planning
canonical_url: https://zenn.dev/hirodeath/articles/plane-project-module-cycle-initiative
published: true
---

Trying to use every organizational level in Plane creates extra containers even when one person is building one feature. A more useful selection rule is to ask what kind of completion you need to check.

Use a Project for ongoing service maintenance, a Module for a feature or release, a Cycle for work within a period, and an Initiative for an objective spanning Projects. These do not need to form a mandatory linear hierarchy.

This is a design proposal based on Plane's official documentation checked on September 11, 2026, and SquadNote's multi-device push implementation. The inspected Workspace had its dedicated Initiatives feature disabled. SquadNote had zero non-archived Modules and zero non-archived Cycles. The arrangements below are proposals, not established operating practice.

## Do not copy one change into four separate tickets

Multi-device push involves token registration, logout, recipient selection, and device reception checks. The repository collects its requirements in `docs/multi-device-push.md`, linked to `SQN-49`.

Using that work as an example, each organizational unit answers a different question.

| Unit | Question | Possible arrangement |
| --- | --- | --- |
| Project | Which service owns this work? | SquadNote |
| Module | Which deliverable must be complete? | Multi-device push support |
| Cycle | What will move forward during this period? | Registration API and logout implementation during a week in September |
| Initiative | What should several Projects achieve together? | Review notification operations across multiple apps |

The last example is hypothetical. A change confined to SquadNote does not need an Initiative.

The design should not duplicate the same work into separate tickets for the Project, Module, and Cycle. One could become Done while the others retain stale states. Establish one Work Item for the actual work, then associate it with the organizational units that are useful.

## Keep the Project as the ongoing maintenance home

The [official Project documentation](https://docs.plane.so/core-concepts/projects/overview) places Work Items, Cycles, and Modules inside a Project.

SquadNote will still need authentication and attendance maintenance after its push feature is complete. Finishing this feature and closing the entire Project are therefore different events.

"Is multi-device push finished?" and "Does SquadNote have unfinished work?" are separate questions. A single status cannot usefully answer both. The Project can remain in progress after a feature is finished because it is the continuing home for that product's work.

## Give a Module deliverable-level acceptance criteria

The [Module documentation](https://docs.plane.so/core-concepts/modules) describes grouping Work Items around features and other bodies of work. Modules can have start and due dates, and a Work Item can belong to several Modules.

If multi-device push becomes a Module, "improve notifications" would be too vague to establish completion. The implementation document supports more concrete criteria:

- Preserve iOS and Android tokens for the same user at the same time.
- Logging out on one device leaves the other device's registration intact.
- Sending targets registered devices belonging to users with notifications enabled.
- Record actual reception on the owner's test devices.

Completing only the first item should not close the Module. Saving a token on the server and receiving a notification on a device are different results.

If the feature also needs to be tracked as part of an application release, a feature Module and a release Module are an option. But a change small enough for one Work Item need not have a Module at all.

## A Cycle's end date is not necessarily a feature's completion date

The [Cycle documentation](https://docs.plane.so/core-concepts/cycles) describes a time-bounded set of work. Unfinished Work Items can remain when the period ends and can be transferred to another Cycle.

Suppose registration and logout change this week, while device reception is checked next week. This week's Cycle ends, but the multi-device push acceptance criteria are still incomplete.

Closing the feature Module just because the Cycle ended would hide the pending device checks. Keep the Module's criteria and plan the unfinished verification in the next period.

Conversely, the fact that Modules can have due dates does not mean every weekly plan needs to be a Module. Choose based on whether you are naming a deliverable or deciding what to work on during a period.

## Consider an Initiative when there is a shared objective

The [Initiatives documentation](https://docs.plane.so/core-concepts/projects/initiatives) describes tracking related Projects under a common objective. The page labels the feature Pro and provides instructions for enabling it.

The dedicated feature was disabled in the inspected personal Workspace. The MCP response also mentioned a Work Item type with the same name, but that is not evidence that the dedicated Initiatives feature is in use. Matching names do not establish matching capabilities or relationships.

As a design example, an objective as broad as "work on personal development" would not tell you which Projects to include or when to finish. "Standardize notification deregistration for the selected apps and complete reception checks for each" makes it possible to list the Projects and acceptance criteria. This illustrates when a shared objective could help; it does not claim that this cross-application work was performed.

## Start with one Work Item

SquadNote's Project and a concrete Work Item already lead to its implementation document. Work was not blocked by the absence of Modules or Cycles.

Start with acceptance criteria in one Work Item. Consider a Module when related tasks grow and the deliverable needs its own completion view. Use a Cycle when planning and carryover across weeks become useful. Consider an Initiative once a specific objective requires judging several Projects together. This sequence is a proposal for the personal-development case examined here.

The effect of additional grouping on completion or sustained use has not been compared. A useful starting check is whether a ticket can clearly express this state: the API changes are complete, while reception on devices remains to be verified.

Implementation source: [multi-device push requirements and verification criteria](https://github.com/takahiro-saeki/circle-hub/blob/0cda1e865ad80d1529197729d8d436e96d56edc7/docs/multi-device-push.md)
