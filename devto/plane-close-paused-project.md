---
title: "What to record before cancelling or archiving personal work in Plane"
published: false
tags: plane, projectmanagement, productivity
canonical_url: null
---

Hiding abandoned work from a list does not preserve why it was abandoned. In Plane, recording the cancellation decision separately from the archive operation keeps evidence available for a later reconsideration.

The research inspected cancelled work items in a personal workspace and SquadNote's archived work item list. The result established the cancellation of individual work, not the shutdown of an entire product. This article uses those observations to examine what a closure record should contain.

## The cancellation reason could not be recovered from the state

A query for work items with `stateGroup = "cancelled"` ran on September 11, 2026. The response contained 1 item and no next page: SQN-22, "Find places to give a lightning talk or presentation about personal development." Its state was Cancelled.

The description contained Notion migration metadata and a note that the original page had no body. Neither the current cancellation reason nor a condition for reconsideration was found. The migrated source state of todo does not establish when or why the work was cancelled.

SquadNote's archived work item list contained 0 entries and no next page. The reads found cancelled work while the archived list remained empty.

SQN-22 being Cancelled also does not establish that SquadNote has stopped. The [growth document at a fixed Git revision](https://github.com/takahiro-saeki/circle-hub/blob/a34608c611ded6549c1176a7977e68e1bc62a8db/docs/growth/README.md) separately records completed initiatives and candidates for subsequent work. One work item's state should not decide how the entire project is treated.

## Distinguish deferral, cancellation, and removal from ordinary lists

[Plane's Work Item documentation](https://docs.plane.so/core-concepts/issues/overview) describes archiving completed or cancelled work items and accessing them through the project menu. Its [Project documentation](https://docs.plane.so/core-concepts/projects/overview) describes archiving and restoring an entire project as separate operations. Archived projects leave ordinary project lists and Workspace search.

Those distinctions support the following proposed decisions.

| Decision | Proposed state or operation | Information to preserve |
| --- | --- | --- |
| Do not execute now, but retain as a candidate | Keep in Backlog | Condition for reconsideration |
| Abandon this work | Set Cancelled | Reason, replacement work, remaining effects |
| Remove finished work from everyday lists | Archive the work item | Reference to the closure decision |
| Remove the entire project from normal navigation | Archive the Project | Overall closure or pause record and storage location |

This table is a proposal, not a record of actions performed. Changing unfinished, paused work to Done or Cancelled merely to hide it gives the closure a meaning that does not match the work.

If an "Icebox" is desired, that name was absent from the retrieved SQN state list. A custom state with that name would need a definition for retaining deferred candidates. It should not be presented as a built-in state already present in this project.

## Leave a brief decision record before closing the work

The following record could describe an abandoned development idea. It is an example concerning separate fictional work, not an invented explanation for SQN-22.

```text
Decision
  Cancel the standalone prototype.

Reason
  The experiment's question will be checked in the main app instead.

Preserved evidence
  Repository revision and experiment notes.

Remaining effects
  Check whether any deployment, scheduled job, or paid resource remains.

Reconsider when
  The main app cannot reproduce the behavior being investigated.

Archive scope
  This work item only; the project remains active.
```

Include what will happen instead and what effects remain, along with the reason. If the idea returns later, that record lets someone assess whether the previous reasoning still applies.

Avoid adding a plausible explanation to an existing ticket whose reason is missing. For SQN-22, the supported observation is that its current description does not establish the reason. The migration record stating that there was no original body should also be retained as it is.

## Check what remains outside Plane before archiving a Project

Archiving a Plane project does not establish that its repository, distributed app, or scheduled service has been stopped. Those resources belong to other systems.

For an actual project shutdown, inspect the relevant repository, runtime environments, scheduled processes, and any need to inform users. Record the results of actions performed in the closure document. This describes the separate scope of shutdown work; it is not work carried out during this article's research.

Preserve the project name and storage location in the closure record so it remains discoverable after leaving ordinary search. Check both that the history is preserved and that someone can find its location later.

## This review left the missing reason unresolved

The reads established 1 cancelled item and 0 archived work items in SquadNote. Archiving, restoring, and stopping related services were not attempted. There is no result here demonstrating that those operations were completed in the inspected environment.

An immediate improvement for future cancellations is to record the reason and reconsideration condition before changing the state to Cancelled. Archiving can then be selected when the recorded decision should remain available but the work no longer belongs in everyday lists.
