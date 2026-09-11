---
title: "Before using Plane Intake, separate the triage decision from the work state"
published: false
tags: plane, productivity, discuss
canonical_url: null
---

An idea or request need not immediately enter the execution backlog. Before adopting Plane Intake as a personal collection point, decide who submits to it and what must be checked before work enters a project.

SquadNote's retrieved feature settings had `intakes` set to false. This article is a proposal based on current documentation and 4 example inputs, not a report of enabling and operating Intake.

## Read Triage separately from the acceptance decision

The [Intake Overview](https://docs.plane.so/intake/overview) describes a place to evaluate outside requests before admitting them to project work. Triage belongs specifically to Intake and is separate from the project's ordinary state groups.

The state an accepted item enters is another choice. Being in Intake does not mean implementation has begun.

The available Intake API description likewise lists Pending, Declined, Snoozed, Accepted, and Duplicate as decision values. No state was changed through that API, and those names are not replaced with ordinary Todo or Done here.

## Distinguish private notes from incoming requests

The documentation describes in-app, public-form, and email channels. The [in-app instructions](https://docs.plane.so/core-concepts/intake) explain creation by Guests. That does not prove an identical flow for every role using Intake as a personal notebook.

A local candidate list can provide an entry point for personal ideas. A note saying improve notifications does not yet identify the screen or problem. It can remain a candidate until the situation and expected outcome are specific enough to accept as work.

For recurring outside bug reports, Intake may help align an accessible submission route with a place someone reviews. No form was published and no email channel was configured in this investigation.

## Use four example inputs to define the next record

These are local design examples, not real incoming requests or observed Plane transitions:

| Example input | Candidate decision | Record alongside it |
| --- | --- | --- |
| Bug with screen, expected result, and reproduction steps | Accept | Target, reproduction, and destination work state |
| Only says slow, without screen or environment | Request information and revisit | Missing information and review date |
| Same target, reproduction conditions, and expected result as existing work | Duplicate | Existing item and reason their scopes match |
| Requests a feature outside this project's scope | Decline | Reason it is outside scope |

Acceptance need not mean immediate implementation; work can enter a backlog for prioritization. Conversely, accepting an underspecified request does not make it ready to implement.

For a later review, record when it should happen and what information would allow a decision. Snoozing alone does not arrange how that information arrives. Asking the submitter is a separate action, and no messages were sent during this investigation.

The 4 examples record a reason and a next reference alongside each proposed decision. They were not turned into automatic classification rules.

## Preserve the disagreement between official pages

The documentation checked on September 11, 2026, disagreed about the state after declining or marking duplicates.

The Overview says declined and duplicate work remains in Intake under Triage. The in-app page instead describes those items entering Cancelled in the project.

Read-only inspection did not establish which behavior applies in this workspace. Consequently, this proposal assumes neither that declining always removes an item from project counts nor that it necessarily increases Cancelled. Adoption checks should inspect the item's destination, state, and inclusion in aggregates after a decision.

During adoption, inspect both the triage decision and the ordinary work state. An API value or tab name alone does not establish completion of the work.

## Decide the destination and reviewer before adding an entry point

Intake is enabled per project. SquadNote's inspected settings had Intake disabled and Views enabled. Reading the settings checked for existing operation; it did not change the configuration.

Before adoption, decide which requests belong, who reviews them, how missing information is revisited, and where accepted work goes. If the immediate need is simply to separate candidates from committed work, an existing candidate file may already cover that part.

The verified scope is the documented role and instructions, current feature settings, and local decision examples. The [read-only record](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/production/2026-09/batch-11/plane-read-results.json) and [examples](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/production/2026-09/batch-11/proposed-configurations.json) are preserved. Submission behavior, notifications, reappearance after Snooze, and role-specific UI actions were not tested.
