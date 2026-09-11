---
title: "What belongs in a Plane Page, and what belongs in a Work Item?"
published: false
tags: [plane, productivity, architecture, documentation]
canonical_url: https://zenn.dev/hirodeath/articles/plane-pages-work-item-boundary
---

The more thoroughly you describe a feature, the longer its Work Item becomes. Background, future plans, acceptance criteria, and test results accumulate in one description. Eventually, the implementer has to search for the scope of the current change.

A useful boundary is how long the information remains relevant. Put assumptions shared by multiple changes in a Page, and keep the conditions for completing the current change in its Work Item.

The example is SquadNote, a personal project. On September 11, 2026, its Plane Project was inspected through read-only access and compared with documents in Git. The Project's Pages listing contained 0 entries at that time. The Page structure below is a proposal based on existing tickets.

## Find the different jobs inside a long parent ticket

`SQN-29` is the parent ticket for introducing a staged transition from trial participation to full membership. Its description covers trial permissions, manual promotion and termination, communication, an application flow, progress tracking, and follow-up after expiration.

`SQN-30`, titled “[Step 1] Implement trial participant permissions and manual promotion and termination” in translation, is a concrete implementation task. Its scope includes API authorization, compatibility with existing invitation URLs, and promotion and termination behavior. Communication features and automatic expiration processing are outside that scope.

Both descriptions contain requirements, but those requirements serve different purposes.

| Information | When it is needed | Proposed location |
| --- | --- | --- |
| Ending a trial removes the relationship with an organization, not the entire account | Across later implementation stages | Shared rules in a Page |
| The initial stage uses manual promotion and termination | To define this change | Work Item scope |
| Permissions agree across Web, iOS, and Android | To determine whether this change is complete | Work Item acceptance criteria |
| A later stage will handle follow-up after expiration | To plan subsequent work | Parent and later Work Items |
| What was checked, against which revision | During review or retesting | A reference to a test document in Git |

The material worth extracting into a Page is the context likely to be copied into several implementation tasks. Moving the current task's scope there too would make the ticket insufficient for judging completion.

## Keep shared rules and their rationale in the Page

[Plane's Pages documentation](https://docs.plane.so/core-concepts/pages/overview) describes Pages as a place for project requirements and other documents. Work Item mentions and creating Work Items from selected text carried a Business label when checked. The proposed information structure does not depend on having those editing conveniences.

For this feature, an initial Page could be as small as this:

```text
Trial participation

Purpose
- Represent participation before a person decides to become a full member

Shared rules
- Ending a trial ends the relationship with the organization
- It does not delete the entire account
- Enforce permissions in the API as well as the interface

Scope by stage
- Initial: manual promotion and termination
- Later: communication, applications, progress, and follow-up after expiration

Related work
- Parent ticket
- Work Items for each stage

Change history
- Assumptions that changed and the reasons for changing them
```

This is a proposed outline extracted from the tickets, not an excerpt from an existing Page. It does not introduce another implementation-status checklist.

When a shared rule changes, review the affected open Work Items as well as editing the Page. For example, changing which history must survive trial termination also changes the termination API's acceptance criteria. Links help locate the affected work; they do not keep the linked descriptions consistent automatically.

## Leave testable completion conditions in the Work Item

A reference to the shared rule “enforce permissions in the API” is not enough to define this implementation. The ticket needs conditions that someone can check. The following examples make the existing scope more explicit:

- A trial participant cannot retrieve data by calling an API outside their permissions.
- Promoting a participant gives them the required permissions in that organization.
- Ending the trial does not delete the entire account or relationships with other organizations.
- The existing invitation flow still works.

These conditions let a reviewer separately assess alignment with the Page and completion of the current ticket.

Adding future communication features to the same checklist would prevent the manual-promotion task from closing even after its implementation is finished. Link subsequent work without adding it to the current definition of done.

## A test record describes a different state from a specification

The related repository contains `docs/testing/sqn-30-trial-participant-checklist.md`. It was inspected at `circle-hub` commit `0cda1e8`; the document's addition appears in commit `12cbb78`. The review used this [fixed repository revision](https://github.com/takahiro-saeki/circle-hub/tree/0cda1e865ad80d1529197729d8d436e96d56edc7).

The document has completed Web checks and unfinished manual mobile checks. It also limits the work to verification in the development environment, excluding production deployment.

That supports the statement that a test document exists and distinguishes checked from unchecked items. A feature plan in the parent ticket, or a partially completed checklist, does not establish completion on every device. The application checks were not rerun for this article either.

The Page describes the intended rules, the Work Item describes the change, and the test document records findings for a particular revision. Linking the Work Item to the test document's commit can preserve that time reference. Development invitation details do not belong in a public specification example.

## Try the split with one long ticket

Start by trying the split with one parent ticket. Choose one with repeated shared assumptions, extract those into a Page, and check that its child Work Items still contain their scope and acceptance criteria.

Then ask whether someone can start work from a child ticket and whether a changed shared rule can be traced to the affected tasks. No Pages were created during this investigation, so there is no measured reduction in search time to report.

A small fix may fit comfortably in one description. The reason to create a Page is that its assumptions need to remain useful across later work, rather than that the current ticket has reached a particular length.
