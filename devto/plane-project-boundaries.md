---
title: "Organizing personal Plane projects around products rather than working directories"
tags: productivity, opensource, git
canonical_url: https://zenn.dev/hirodeath/articles/plane-project-boundaries
published: false
---

As personal repositories accumulate, directory names can seem like a convenient way to decide where tasks belong. But treating every worktree for a fix as a separate project scatters the unfinished work for one application.

The local SquadNote checkouts include working directories such as `circle-hub-multi-device-push` and `circle-hub-android-safe-area-hotfix`. Plane has one Project named `SquadNote`. From a user's perspective, a notification fix and an Android layout fix both change the same service.

This article uses the personal Workspace's Project list and repository records inspected on September 11, 2026, to establish a rule for assigning tasks. It does not describe a completed migration of every personal project into Plane.

## Start with the Projects that actually exist

Listing Projects in the personal Workspace returned these five entries. The response also confirmed there was no next page; this was not a conclusion based on the first page alone.

| Project | Identifier | Scope confirmed by the list and local records |
| --- | --- | --- |
| SquadNote | SQN | A group management service, with the repository name `circle-hub` |
| SLABYRINTH | DRG | A game, with the repository name `dungeon-roguelite` |
| meguri | MEG | A service for reflection, group work, and coaching |
| Recital Originals 2026 | RECITAL | Production of original music |
| hiro work | HIROW | Its description identifies it as a Plane demo Project |

There was no dedicated article Project in this list. Nor would the name `hiro work` justify treating it as an inbox for every unclassified idea. Even when a Project shares its name with the Workspace, its description needs checking.

Plane's [official Project documentation](https://docs.plane.so/core-concepts/projects/overview) describes Projects as containers for work within a Workspace, with identifiers included in Work Item numbers. It does not require a one-to-one relationship with Git repositories or worktrees.

## Keep working copies of one service in the same Project

SquadNote's multi-device push work has a repository document, `docs/multi-device-push.md`. It identifies `SQN-49` as the associated ticket. The working directory may have a long name, but the work still belongs to `SQN`.

The mapping leads back to the same Project even as working directories multiply.

```text
SquadNote / SQN
  ├─ circle-hub
  ├─ circle-hub-multi-device-push
  └─ circle-hub-android-safe-area-hotfix
```

This diagram explains the intended grouping. Plane is not automatically discovering and linking these directories.

First decide whether a new task creates a different product or changes an existing one. For the latter, recording the working branch or directory in the Work Item's description is enough. Creating another Project would add another list to check before release.

The push fix, for example, spans a registration API on the web side and logout behavior on mobile. For this change, keeping both requirements in one Project fits better than splitting web and iOS into separate Projects. If the maintenance responsibilities later separate, that boundary can be reconsidered.

## Product and repository names do not have to match

The SLABYRINTH README records the product name while retaining `dungeon-roguelite` as its development identifier. In Plane, the Project is named `SLABYRINTH` and its identifier is `DRG`.

Everything need not be renamed at once if the relationship is documented. Recording only the product name, however, makes finding the code harder. Including both names in the Project description and linking from the repository README to release-ticket documentation preserves a usable entry point after a rename.

Product names, repository names, and ticket identifiers serve different purposes. Whether past tasks should move to a different Project depends on their scope, rather than a display-name change alone.

## Do not force work into a Project without an agreed destination

Article production in this repository has an ideas list and a production status table. At the time of inspection, there was no corresponding Plane Project.

The proposed next step depends on whether article production will continue as an independent activity. Sustained work could justify a dedicated Project; a one-off note could stay in the repository's ideas list. These are future options, not a claim that an article Project has already been created.

For the same reason, the demo Project should not silently become an inbox. Having a generic name is different from being an agreed destination.

For a new task, check its destination in this order:

1. For a change to an existing service or game, use that product's Project.
2. When repository names differ, check the README and Project description for the mapping.
3. If no destination exists, establish whether there is a continuing deliverable before choosing where to track it.

## What this inspection establishes

The list and repository records establish that product-level Projects exist, and that at least SquadNote and SLABYRINTH provide routes from their code repositories to tickets. They do not measure minutes saved finding tasks or a reduction in unfinished work.

This is also an organizational boundary within a personal Workspace. It is not a proposal to bring company information into that Workspace.

Adding a local working directory does not require adding a Project. When checking whether a notification fix is complete, the place to look should remain `SquadNote / SQN`. Recording that relationship in both Plane and the repository is the rule adopted here.

Implementation source: [multi-device push requirements and verification criteria](https://github.com/takahiro-saeki/circle-hub/blob/0cda1e865ad80d1529197729d8d436e96d56edc7/docs/multi-device-push.md)
