---
title: "Where to draw the boundary between GitHub Issues and Plane"
published: false
tags: [plane, github, productivity, architecture]
canonical_url: https://zenn.dev/hirodeath/articles/plane-github-issue-boundary
---

Even when work is managed in Plane, code review happens in GitHub PRs. Creating a GitHub Issue for every Plane task adds another place to update descriptions, assignees, and completion status.

First decide where each piece of information is edited. If Plane already has the implementation task and there is no reason to accept an Issue on GitHub, start by linking the Work Item to the PR. Creating another Issue need not be a prerequisite for connecting the work.

This is an operating proposal based on official documentation checked on September 11, 2026. It does not report a production integration rollout or measured success eliminating duplicate administration.

## Related work can need different information

Consider a task to restrict trial participants' permissions. Plane can hold the purpose and acceptance criteria, while the PR holds the code changes and verification results.

| Information | Primary editing location | What the other location retains |
| --- | --- | --- |
| Why the change is needed and what makes it complete | Plane Work Item | A reference from the PR |
| Which code changed and how | GitHub PR | A reference from the Work Item |
| Reproduction steps reported by a user | The GitHub Issue used for intake | A reference and response plan in Plane |
| Checks required after release | Plane Work Item | References to the relevant PR or release |

This is a suggested allocation, not a requirement to use GitHub Issues in every project.

A repository accepting public bug reports has a reason to keep an Issue where the reporter can participate. Editing a second copy of the entire report alongside internal priorities and implementation plans lets the two descriptions drift apart. Link to the original report and choose a home for the response decisions.

## Consider synchronization after choosing the editing locations

[Plane's GitHub integration documentation](https://docs.plane.so/integrations/github) was marked Pro when checked. Issue synchronization can be unidirectional or bidirectional. The unidirectional mode runs from GitHub to Plane and overwrites Plane content; the bidirectional mode propagates changes from both sides.

This makes a separate acceptance-criteria document inside a unidirectionally synchronized Plane description a poor fit. If the source does not contain that text, its survival across subsequent updates cannot be assumed.

Even with synchronization, choose an editing rule such as this:

```text
Proposed workflow when GitHub handles intake

Reproduction steps: edit in the GitHub Issue
Implementation acceptance criteria: edit in a separate Plane Work Item
Relationship: reciprocal links
Synchronized description: do not append a separate independent document
```

A “separate Work Item” does not mean manually duplicating the same text. It means creating tasks with their own completion conditions when responding to a report requires multiple implementations or release steps. A simple fix may fit entirely in one Issue without an additional independent Plane description.

Bidirectional synchronization can support editing from either side, but it does not separate a report intended for users from a plan intended for implementers. Changing the synchronization direction does not organize a document's audience or purpose.

## Choose linking and state automation separately

The same documentation distinguishes Plane IDs in PR titles or descriptions: with the integration configured, `WEB-344` creates a reference, while `[WEB-344]` also enables state changes according to the PR event mapping. Here is a PR-body example using the documentation's illustrative ID:

```text
Related work: WEB-344
```

This allows a workflow where the PR is linked while task state is updated after checking acceptance criteria. To use automatic state changes, check the event mapping and use the bracketed form:

```text
Related work: [WEB-344]
```

Writing the text does not configure an integration by itself. The distinction matters because associating a PR with a task and letting PR events change task state are different intentions.

If migration, distribution, or production verification remains after merge, mapping a merged PR directly to Done closes the overall task too early. One proposed mapping is “Implemented”; another option is to leave automatic changes disabled and check the remaining acceptance criteria manually. For a small fix whose completion condition is merging the code, mapping to Done may be appropriate.

## GitHub's Issue-closing syntax is a separate mechanism

GitHub also links PRs to Issues. Its [official documentation](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/linking-a-pull-request-to-an-issue) says closing-keyword links in a PR description are interpreted when the PR targets the default branch. Merging there closes the linked Issue.

For example, this syntax refers to a GitHub Issue:

```text
Closes #123
```

It is not an instruction to close a Plane Work Item. A numeric GitHub Issue reference and a Plane ID containing a Project identifier belong to different mechanisms.

Likewise, “PR closed” alone does not establish whether the PR was merged or closed without merging. If task state should reflect satisfied acceptance criteria, connect each event to an explicit reason for considering the task complete.

## Verify where updates go

This investigation verified the documented synchronization directions, reference formats, and closing-keyword conditions. It did not test synchronization latency, concurrent-edit conflicts, or the integration settings of the personal environment.

At an actual rollout, use test Issues and Work Items separate from real work. Change the title, description, and state from one side at a time, and record where each update appears. Check separately that a reference-only PR leaves state unchanged and that an automation-enabled reference follows the configured transitions.

Before that test, establish a layout where you can say “reports are corrected here” and “implementation acceptance criteria are maintained here.” That gives you an intended result against which to judge synchronization. Where a second copy of the same text is unnecessary, start with references alone.
