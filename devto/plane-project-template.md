---
title: "Separate reusable settings from per-project decisions in Plane Project Templates"
published: false
tags: plane, productivity, discuss
canonical_url: null
---

When templating the start of a personal project, do not blindly reuse the previous project's identifier, dates, or assignee. Reuse the initial checks, while deciding the repository and delivery path for each new project.

This article reviews Plane's Project Templates documentation and prepares a local proposal with 3 initial tasks. No template was saved in Plane and no project was created.

## Select the template for the right scope

The [Project Templates reference](https://docs.plane.so/templates/project-templates) carries a Business label. It describes project properties, States, Labels, Work item types, and initial work items, configured through Workspace Settings and Templates.

[Work Item Templates](https://docs.plane.so/templates/work-item-templates) instead reuse an individual item's content and child work. Adding another task to an existing project does not require recreating the project itself.

The proposal here prevents the initial decisions for a new project from being left blank. It is not a migration case involving duplication of an existing project.

## Use three tasks for the initial decisions

Prepopulating every development step can turn an unchosen delivery path into a default. These 3 tasks establish the project's conditions first:

| Initial task | Result to preserve |
| --- | --- |
| Confirm the target and management location | Product, repository, owner, and references |
| Decide the first deliverable | Delivery path and initial scope |
| Prepare the first verification procedure | Execution conditions, expected result, and record location |

No measurement establishes 3 as an optimum. The tasks capture decisions about target, delivery, and verification.

For example, completing the verification-procedure task means recording the inputs and expected observations, not merely reporting that something was tried. That is distinct from a successful product test; an unbuilt feature has not passed verification.

## Do not freeze decisions that belong to the new project

| Field | Template's role | Check in the new project |
| --- | --- | --- |
| Name and identifier | Explain naming | Actual product name and collisions |
| Repository | Provide a place to record it | Target URL, owner, and working location |
| Lead and visibility | Explain the policy | Who works on it and who can see it |
| Dates | Explain when to decide them | A feasible schedule for this project |
| States and labels | Keep meanings consistent | Values and mappings in the new project |
| Delivery path | Have an initial task select it | Web, store, game distribution, or another target |

Reusing a label name is different from reusing another project's identifier. [Work Item Labels](https://docs.plane.so/core-concepts/issues/labels) are configured per project. Later API additions should not reuse an old label ID simply because its displayed name matches.

The previous project's dates and assignee need individual review. Successfully saving a configuration does not establish that its values fit the new use.

## Apply the proposal to two fictional projects

The local proposal was considered for fictional projects named Web Lab and Game Lab. Neither a real Plane project nor a repository was created.

| Check | Web Lab | Game Lab |
| --- | --- | --- |
| Proposed identifier | WEBLAB | GAMELAB |
| First deliverable | Web preview | Browser game package |
| Initial verification | URL and principal flows | Startup and controls |
| Shared initial tasks | The 3 target/delivery/verification tasks | The same 3 tasks |

The common questions remained while delivery and verification changed. A game need not inherit a web service's login check automatically, and a web project need not require a gamepad check.

This is a review of the proposed configuration, not observed task generation by Plane. Setup-time savings were not measured. Some concrete values intentionally remain undecided, so the JSON is not designed to be sent directly to the API.

## Prepare the read-back checks before adopting it

The documented project-creation flow selects a template, allows adjustments, then creates the project. The proposal adds a deliberate review of identifier, lead, visibility, and dates at that point.

After creation, inspect the count and descriptions of initial tasks, their state/label mappings in the new project, and any inherited dates or references. Propagation of later template edits into existing projects was not verified.

The template-list API returned no content in this investigation. That alone does not prove there are zero templates, so the existing template count remains unknown. Subscription availability, permissions, and actual UI behavior remain adoption checks.

The official material was checked on September 11, 2026, and the [3 tasks with 2 local applications](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/production/2026-09/batch-11/proposed-configurations.json) were saved. The proposal reuses the initial checks; each project still needs its own values.
