---
title: "Parentheses change Plane PQL results: compare 121 and 150 items by state"
published: false
tags: plane, testing, productivity
canonical_url: null
---

A query intended to find open High or Urgent work can include completed items when AND and OR are combined incorrectly. In the personal workspace, parentheses produced 121 results; removing them produced 150. The extra 29 were Completed.

Before saving PQL as a view, compare counts and their state breakdown. This investigation used read-only queries and independent calculations over the retrieved rows.

## Define the desired set in one sentence

The target was open work whose priority is either Urgent or High. Open meant the Backlog, Unstarted, and Started groups.

This query was executed:

```pql
stateGroup IN (openStates()) AND (priority = "urgent" OR priority = "high")
```

The parenthesized expression selects priorities, and the open condition applies to that entire selection. The [PQL reference](https://docs.plane.so/core-concepts/issues/plane-query-language) supplied the definitions of logical operators, stateGroup, and openStates.

This comparison removed the parentheses:

```pql
stateGroup IN (openStates()) AND priority = "urgent" OR priority = "high"
```

AND was evaluated before OR, producing open-and-Urgent work or High work. The latter branch did not require an open state.

## Grouping exposes where the counts differ

The read covered 233 accessible non-archived items in the personal workspace on September 11, 2026. Every page was retrieved, and identifiers were checked for duplicates.

| State group | With parentheses | Without parentheses |
| --- | ---: | ---: |
| Backlog | 106 | 106 |
| Unstarted | 6 | 6 |
| Started | 9 | 9 |
| Completed | 0 | 29 |
| Total | 121 | 150 |

Independent Python predicates over the retrieved rows matched the API's grouped counts. The check looks for states that should have been excluded.

The 3 open-state rows were identical in this data. Looking only at the overall size makes it easier to miss the completed High-priority work.

Multiple choices for one field can also use IN:

```pql
stateGroup IN (openStates()) AND priority IN ("urgent", "high")
```

That returned 121 too. It expresses the priority choices compactly. It does not replace every OR involving different fields.

## Keep overdue work separate from missing dates

These two queries were executed as additional review entry points:

```pql
isOverdue()
```

```pql
stateGroup IN (openStates()) AND dueDate IS NULL
```

They returned 15 and 56 items respectively. Overdue work has a date and remains open; the second set lacks a date. Adding the 56 to an overdue count would mix different conditions.

A review-waiting or publication-waiting entry point also needs a corresponding state or label. This investigation did not reinterpret every Started item as awaiting review or insert nonexistent label names into queries. Waiting reasons recorded only in descriptions cannot automatically be recovered by these structured conditions.

## A grouping parameter is not a PQL field

The read-only API accepted `state__group` as its `group_by` parameter. Using the same spelling inside PQL failed:

```pql
state__group = "started"
```

The response was `Filtering on field 'state__group' is not allowed`. The PQL field is:

```pql
stateGroup = "started"
```

That returned 12 items. The tested API uses different names for grouping and PQL filtering. UI names, response fields, and search-language fields are not necessarily identical.

## Save a condition after checking the set it describes

Begin with one condition and inspect whether known items match. After adding conditions, look for states that should have been excluded. Recheck parentheses around added OR branches, then confirm that missing dates and assignees remain visible through another entry point.

Saving according to the [View instructions](https://docs.plane.so/core-concepts/views) comes afterward. This work executed searches and aggregations without creating or sharing views or saving a dashboard. The documentation marks PQL as Pro, and available fields also depend on enabled features.

The [17-query record](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/production/2026-09/batch-11/plane-read-results.json) and [independent calculations](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/analyze-plane-batch11.py) are available. Verification used the Plane read-only API and Python 3.14.5 on September 11, 2026. Counts will change, but the sets created inside and outside parentheses can be inspected before saving.
