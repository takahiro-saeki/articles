---
title: "An empty cross-project Plane view does not mean there is no work for today"
published: false
tags: plane, productivity, testing
canonical_url: null
---

Filtering for open work assigned to the caller and due by today returned 0 items. Removing the assignee condition returned 15, all of them unassigned.

A view spanning projects can only match the assignee and date values actually stored. Use separate entry points for work to inspect today and work excluded because those values are missing.

## Start at workspace scope

The [Views reference](https://docs.plane.so/core-concepts/views) distinguishes a Project View from a Workspace View spanning projects. This task needs the latter, using Views at workspace level to configure its conditions.

The documentation describes Workspace Views with a spreadsheet layout. Do not transfer the all-layout support described for Project Views to the workspace scope.

No view was created or saved for this article. Read-only PQL calls against the personal workspace tested the conditions before saving, with results checked against retrieved work-item values.

## Define today in terms of a due date

The reference date was September 11, 2026. Due by today means a due date on or before that date, in the Backlog, Unstarted, or Started groups. It does not mean work starting today, work someone wants to begin today, or work that can all be finished today.

This query was executed:

```pql
assignee = currentUser() AND stateGroup IN (openStates()) AND dueDate <= today()
```

currentUser means the authenticated user executing the query. Another person's execution changes the assignee condition. The [PQL reference](https://docs.plane.so/core-concepts/issues/plane-query-language) supplied the definitions of currentUser, openStates, and date comparisons.

The accessible non-archived collection contained 233 items across 5 projects. Its 3 pages contained 100, 100, and 33 items. The final page had no successor, and identifiers were unique.

| Inspected set | Count |
| --- | ---: |
| All open work | 174 |
| Open work assigned to the caller | 6 |
| All open work due by today | 15 |
| Open work due by today and assigned to the caller | 0 |
| Open work due by today with no assignee | 15 |

Python also found no assigned row in the due set when evaluating the retrieved values. The empty result matched the stored data.

## Keep a separate entry point for missing values

This query checked the unassigned due work:

```pql
stateGroup IN (openStates()) AND dueDate <= today() AND hasNoAssignee()
```

It returned 15 items. Considering everything in a personal project to be your responsibility does not automatically populate its assignee field.

Missing due dates need a separate condition:

```pql
stateGroup IN (openStates()) AND dueDate IS NULL
```

That returned 56 items. Without a date, they do not match an on-or-before comparison. Assigning today's date to all 56 simply to make them appear would distort the field. The [Due date definition](https://docs.plane.so/core-concepts/issues/properties) describes an expected completion date, not a marker for inclusion in a list.

Candidate saved views are therefore the caller's due work, dated work without an assignee, and an audit of missing dates. Use the missing-value views to decide ownership and scheduling before choosing today's work.

## Exercise the boundaries before treating the result as a plan

The local audit function also received 7 synthetic inputs covering yesterday, today, tomorrow, no due date, completed, cancelled, and unassigned work. It found 5 open items, 3 due by the reference day, and 1 unassigned item within that due set.

That tests the Python audit function. It does not test Plane's parser, saved-view UI, or date rollover by creating fixture tickets. Live PQL counts were checked separately against the 233 retrieved rows.

Timezone behavior at midnight was not tested. A query using a literal reference date alongside `today()` also returned 15 on this date. This is a reproducibility aid, not an expectation that the live count remains unchanged later.

## Finding work does not decide how much to start

Finding 15 items does not establish that all 15 can be completed today. Overdue work may need a revised date, clarification of an external dependency, or a decision to stop. No individual schedule was changed during this investigation.

Before saving a view, check project scope, the definition of open, assignee, due date, and displayed columns. The documented save step after editing conditions is another behavior to verify. The executed queries are verified here; reopening a saved view is not.

Verification used read-only access to the personal Plane workspace and Python 3.14.5 on September 11, 2026. The [retrieved records](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/production/2026-09/batch-11/plane-read-results.json) and [audit code](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/analyze-plane-batch11.py) are available. The public documentation marks PQL as Pro; check the filters and permissions available in the target environment before saving.
