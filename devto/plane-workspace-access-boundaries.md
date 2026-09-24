---
devto_id: 4728668
title: "Split Plane Workspaces or Projects based on who may administer the data"
published: true
description: "Private projects restrict participation, but workspace administrators remain a separate consideration when separating personal and company work."
tags: productivity, projectmanagement, opensource, devtools
canonical_url: https://zenn.dev/hirodeath/articles/plane-workspace-access-boundaries
---

Putting personal projects and company work in one Plane workspace can be appealing. It avoids switching screens and keeps today's tasks together.

The mistake is assuming that a Private Project also creates a space independent of workspace administrators. Before splitting projects, decide whether the administrators of the same Workspace may see the information.

This is a design proposal based on official documentation checked on September 11, 2026. It is not an investigation of a company Workspace or a record of migrating an existing Plane setup. Actual permissions require checking the edition, role configuration, and installed version.

## Private Projects still have an administrator exception

The official [Project documentation](https://docs.plane.so/core-concepts/projects/overview) limits Private Projects to explicitly invited members while also allowing Workspace Admins to access them.

The [Member roles reference](https://docs.plane.so/roles-and-permissions/member-roles) adds that the former workspace-level Admin role was renamed Owner. Owners have access throughout the Workspace, and Admins can access project content without being added as project members.

The official pages contain both older and newer role names. Rather than deciding from the word “Admin” in a screen, check whether the role administers the Workspace or only an individual Project.

Personal tasks that should not be shared with company administrators do not belong in a Private Project inside the company Workspace. If the administrator is shared and only the usual participants or workflow need to differ, Projects remain a possible boundary.

## Write down whether the boundary concerns administration or work

The [Workspace overview](https://docs.plane.so/core-concepts/workspaces/overview) describes a Workspace as the unit containing Projects, with membership and integration settings managed at that level.

The following are example design choices, not a list of settings already applied to an environment:

| Reason for separation | Unit to consider | Deciding factor |
| --- | --- | --- |
| Personal and company work have different administrators | Workspace | Keep membership and administrative authority separate |
| One person administers both a web app and a game | Project | Shared administrator, different work |
| A project in one organization needs limited participation | Private Project | Workspace administrator access is acceptable |
| An improvement effort is open to the organization | Public Project | Workspace members can discover and join it |

Creating another Workspace merely because the ticket count grew mixes organizational convenience with an administrative boundary. Decide who administers the data first, then split Projects within that scope.

Personal work with multiple collaborators does not automatically belong in a single Workspace either. Name the people who will keep administering it, decide invitations, and receive access to the work. Then determine whether they fit under the same administration.

## Public Projects and Internet publication are separate

“Public” can also cause confusion. Public in a Project's visibility settings is described as allowing Workspace members to discover and join the Project themselves. Guests need an explicit invitation.

There is a documentation distinction here: the Project overview describes member access broadly, while the roles page says that access to content requires joining the Project. These descriptions do not establish identical behavior for every screen. For design purposes, treat it as a scope that ordinary members can join themselves, and verify it with the actual role.

A separate [Publish Project feature](https://docs.plane.so/core-concepts/deploy) creates a public page that can be viewed without signing up.

These are therefore separate settings:

- Which people in the Workspace can join or access the Project.
- Whether viewers outside the Workspace receive a public page.

A request for an external roadmap does not mean every detail in the working Project needs to become public. Include a procedure for choosing what to expose. No publishing or permission changes were performed for this article.

## Your administrator view is not a complete permission test

Being able to open a Project as its administrator does not establish what an ordinary member sees.

For verification in the target environment, use test data without confidential content and distinguish an ordinary member who has not joined the Project from a Workspace administrator. For both Private and Public Projects, record whether each role can discover it, open its URL directly, and join without an invitation.

Check published pages in a browser that is not logged into the Workspace. Testing participation permissions inside a Project and testing a published page's visibility are separate tasks. Those checks with different roles were not performed in this investigation.

Separate Workspaces also do not, by themselves, establish separate account authentication or isolation of a self-hosted infrastructure. The boundary discussed here is Plane's administrative unit. Infrastructure isolation and company authentication policy require their own checks.

When unsure where to split, first answer: may the person administering this Workspace open this Project? If yes, choose the Project's visibility and participants within it. If no, reconsider which Workspace should contain it. That order keeps organizational convenience from obscuring the administrative boundary.
