---
title: "Choosing a Plane state group for work that is waiting for verification"
published: false
tags: plane, productivity, projectmanagement
canonical_url: null
---

Before adding a state called "Ready for verification" in Plane, decide whether the work is complete. If verification belongs to its acceptance criteria, changing the display name should still leave it in an unfinished group.

The state configurations of three personal projects covering a game, a concert, and an app were compared by name and group. No record of a past incident caused by uniform states was found in this research, so the article uses the retrieved configuration to examine how a verification state could be classified.

## The three projects currently have the same configuration

The States lists for DRG, RECITAL, and SQN in the personal workspace were retrieved on September 11, 2026. Each response indicated that there was no next page. The comparison covers the name, group, and default flag. It does not cover every project in the workspace.

| Display name | group | Default state |
| --- | --- | --- |
| Backlog | backlog | Yes |
| Todo | unstarted | No |
| In Progress | started | No |
| Done | completed | No |
| Cancelled | cancelled | No |

Each project had 5 states with the combinations shown above. Their state IDs differed across projects, however. A Done ID retrieved from SQN is not an ID to reuse in an update to DRG.

None of these three lists contained states named "Ready for verification" or "Ready to publish." The following configuration is a proposal. No project settings were changed.

## Inspect the group before relying on the name

[Plane's state documentation](https://docs.plane.so/core-concepts/issues/states) defines the Completed group as the group counted as done. A custom display name does not remove the behavior associated with its group. Enterprise Grid Governance can manage states separately from ordinary project settings, so check where your deployment permits changes.

Putting "Ready for verification" in Completed makes the name say that verification remains while the classification says that the work is complete. Conversely, leaving a work item in In Progress after it has met its criteria fails to record its completion.

When development and publication share a state list, first read the scope of the individual work item.

| Acceptance criteria | Current position | Proposed state |
| --- | --- | --- |
| Work in the development environment and finish required device checks | Mobile verification remains | Ready for verification / started |
| Finish development checks; production distribution is outside scope | All criteria are met | Done / completed |
| Publish an article and check its public page | Only the manuscript is ready | Ready to publish / started |

These are proposed operating rules. Plane does not require every publication queue to use started. If a work item covers manuscript preparation alone, it can become Done after editing, with publication tracked as separate work.

## Apply the distinction to an actual acceptance criterion

SQN-30 covers trial participant permissions, manual promotion, and ending trial membership. Its retrieved description requires consistent behavior across Web, iOS, and Android, and explicitly excludes production deployment. Its Plane state was In Progress.

The [verification document at a fixed commit](https://github.com/takahiro-saeki/circle-hub/blob/0cda1e865ad80d1529197729d8d436e96d56edc7/docs/testing/sqn-30-trial-participant-checklist.md) contains completed Web checks and an unchecked mobile device verification item. The research for this article compared the document with the ticket without rerunning the app checks.

Under those criteria, a separate verification state could identify the outstanding mobile work. Waiting for production distribution would add a requirement that this work item does not contain.

A small list can help inspect the proposed classification. This example does not update real data.

```js
const proposed = [
  { name: "Ready for verification", group: "started" },
  { name: "Ready to publish", group: "started" },
  { name: "Done", group: "completed" },
];
const completedNames = proposed
  .filter(state => state.group === "completed")
  .map(state => state.name);
console.log(completedNames); // ["Done"]
```

The local run left only Done in the completed selection. In a comparison that changed just the group of "Ready for verification" to completed, that name also appeared. This demonstrates classification only. It does not reproduce Plane's displayed percentages or its full aggregation behavior.

## Share the completion rule, then choose useful names

For an initial review, write a sentence defining when each state applies. "Ready for verification: acceptance checks for this work item remain" lets the work item identify who will check it and where the results will go. Changing the reviewer alone need not add another state.

Putting a game's distribution checks and a concert's event operations into the same "Ready to publish" state can make the remaining work harder to understand. Choose names appropriate to the deliverable while sharing the rule that unfinished acceptance work does not count as complete.

This review covered the current configuration of three projects and one real set of acceptance criteria. It did not measure usability or waiting times after introducing new states. Before adding a state, choose one work item and check whether you can explain both the condition for entering it and the condition for leaving it.
