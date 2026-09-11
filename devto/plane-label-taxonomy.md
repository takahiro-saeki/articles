---
title: "Before adding Plane labels, count what states and priorities already tell you"
published: false
tags: plane, productivity, discuss
canonical_url: null
---

Before adding categories in Plane, check what the existing properties already let you find. SquadNote had no labels in the inspected project, but its work items did have states and priorities.

There is no verified history here of creating too many labels and then pruning them. This article uses the current 52 items and Git records to decide what future labels might classify. No labels were added or deleted in the live project.

## Read both the label list and the work items

On September 11, 2026, the label list for SquadNote in the personal workspace returned 0 items and no next page. After retrieving every page of workspace work items, all 52 items belonging to SquadNote also had empty labels.

Checking both distinguishes an absent taxonomy from a taxonomy that exists but has not been applied. Both were checked here.

| Existing classification | Count |
| --- | ---: |
| Completed | 29 |
| Started | 6 |
| Backlog | 11 |
| Unstarted | 5 |
| Cancelled | 1 |
| High priority | 21 |
| Medium priority | 25 |
| Low priority | 6 |

The 5 state rows and 3 priority rows classify the same 52 items along separate dimensions; adding them does not give a work-item count. Completion and priority can already filter work without labels. The [work-item properties reference](https://docs.plane.so/core-concepts/issues/properties) defines State, Priority, Assignees, and Labels separately too.

These counts cover the non-archived items returned at retrieval time. They do not establish whether labels existed earlier or how historical work was organized.

## Do not automatically turn technology names into work categories

SquadNote's [architecture document](https://github.com/takahiro-saeki/circle-hub/blob/770de5f2989775cfd95f7a9c4529565a2b48d2fd/docs/architecture.md) describes its web, API, and database structure. Its [Instagram production record](https://github.com/takahiro-saeki/circle-hub/blob/e295f5cedf9f8989b36c9f308dee4dbd8cf64c3f/docs/marketing/instagram/001-invite-join/README.md), meanwhile, links to SQN-47 and identifies editable HTML/CSS, captions, and alt text.

Git history shows that the production document evolved from initial creation into later operating instructions, and the referenced `index.html` exists. That does not establish that every checklist entry in the document was completed.

Copying HTML and CSS into the taxonomy would group application-screen changes with social-media asset production. That is useful for finding everything using CSS, but a different category is needed to review publishing assets together.

The architecture document is pinned to identify the inspected material, not to describe current dependency versions. The relevant observation is that one project's records cover both application structure and content deliverables.

## Write the recurring search before naming the label

The following is a proposal for selecting categories, not a list of labels already configured:

| What needs finding | First place to look | Decision about labels |
| --- | --- | --- |
| Work needing priority attention | Priority | Do not duplicate it with an urgency label |
| Work in progress | State / stateGroup | Do not add a synonymous implementation label |
| Bug reproduction and fixes | Description, then work type if needed | Consider kind:bug for a repeatedly needed list |
| Deliverables intended for publication | Source material and deliverable | Consider kind:content for a publishing-assets review |
| Uses of a particular library | Repository code and dependencies | Do not bulk-tag every work item with technologies |

If kind:content is adopted, its rule could be that the deliverable is a publishable image, video, or text. Merely containing HTML would not qualify. A bug category would likewise not cover every feature request.

The experiment has not proved that these 2 labels are sufficient. They are initial candidates. Another recurring search that requires rereading descriptions could justify another dimension. Without usage observations, there is no measured optimum label count.

## Check one project before expanding the taxonomy

The [Plane labels reference](https://docs.plane.so/core-concepts/issues/labels) defines labels within projects. Inspect each project's configuration instead of assuming that matching names in separate projects represent one shared label. Use labels for categories that states, priorities, and assignees do not already express.

Before removing similar names, inspect their work-item assignments and any views using them. The reference describes removal from assignments and views, including child-label deletion when removing a parent. None of those deletion operations was exercised against this empty label set.

Check whether the resulting list gathers the intended publishing assets while leaving state and priority in their existing fields. Apply a small taxonomy to a few real tasks in one project, inspect both inclusion and exclusion, then consider expanding it to other projects.

The [analysis record](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/production/2026-09/batch-11/plane-analysis.json) preserves the retrieved counts and local calculations. Verification used read-only Plane calls and Python 3.14.5. Search-time savings and the effect of changing the taxonomy were not measured.
