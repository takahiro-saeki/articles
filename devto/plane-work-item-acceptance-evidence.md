---
title: "Separate acceptance criteria from verification results in Plane work handed to Codex"
published: false
tags: plane, ai, productivity
canonical_url: null
---

"Use consistent permissions across Web, iOS, and Android" is an acceptance criterion. "Verified on Web; mobile device checks remain" is a result. Keeping these separate in a Plane description handed to Codex makes the required behavior and the remaining work distinguishable.

The actual SQN-30 description was compared with a verification document in its repository. No ticket was created or updated. The existing records provide a concrete example of what a work description needs when it is handed to an implementation agent.

## The description already defines scope and a stopping point

The title of SQN-30 retrieved on September 11, 2026 was "[Step 1] Implement trial participant permissions and manual promotion and termination." Its description separates purpose, implementation scope, acceptance criteria, and exclusions.

The following table condenses those sections into the decisions they support.

| Category | Content found in the description |
| --- | --- |
| Permission assignment | Determine the invitation type on the server; changing the URL must not change permissions |
| Compatibility | Preserve legacy invitation URLs and disable them explicitly after verification |
| Promotion and termination | Allow manual promotion; ending a trial removes only the organization relationship |
| Verification requirements | Consistency across Web, iOS, and Android, regression checks for existing members, automated tests |
| Stopping point | Development environment and automated tests only; no production database, Web, or store deployment |
| Exclusions | New individual messaging, applicant management, automatic expiration, production release |

The description explicitly stops the work in development. "Implement this" alone would leave it unclear whether completion means development verification or production availability.

The retrieved description did not contain a repository URL or a reference to a fixed commit of the verification document, however. A detailed description does not necessarily identify where the next person should look.

## Match each criterion to the record that addresses it

The inspected source is the [verification document at a fixed commit](https://github.com/takahiro-saeki/circle-hub/blob/0cda1e865ad80d1529197729d8d436e96d56edc7/docs/testing/sqn-30-trial-participant-checklist.md). Its addition appears in history at `12cbb78`; the version referenced here is `0cda1e8`. The existence of the history and the verification results recorded in the document are separate evidence.

The document contains completed Web checks, while the mobile device verification item remains unchecked. The ticket was also In Progress when retrieved.

| Acceptance criterion | What the fixed document records | Treatment in this article's research |
| --- | --- | --- |
| Fix permissions using the invitation type | A Web check that changes URL parameters | Record inspected; behavior not rerun |
| End only the organization relationship when a trial ends | Checks of login after termination and removal of membership | Record inspected; behavior not rerun |
| Keep permission differences consistent across clients | Web results and an outstanding mobile device check | Not treated as verified across all clients |
| Do not deploy to production | Defined as a stopping condition | No extra distribution required for completion |

A total count of checked boxes loses this correspondence. Many passing automated tests do not establish that a criterion concerning an untested device has been satisfied. Reading the document for this article also does not repeat the checks originally recorded there.

## Do not invent results when creating the ticket

The following order could be used for new work. It is a proposed description structure based on the existing ticket, not a special format that Codex automatically parses.

```text
Purpose
  The behavior that this change should make possible.

Repository
  Repository URL, working directory, and the starting revision.

Scope
  The changes included in this work item.

Acceptance criteria
  Observable behavior for each role and client.

Verification plan
  Checks to run and the location for their results.

Current evidence
  Not run, or a reference to an existing result and its revision.

Stop point
  The environment where the work must stop.

Out of scope
  Changes that require separate work.
```

At creation time, a verification plan may be all that exists. In that case, leave the result as not run. A plan to add tests should not occupy the same field as a claim that tests passed.

When results are added later, identify the target commit, environment, checks performed, and remaining criteria. For work with several branches of behavior, recording the role, operation, and client is more useful for selecting the next check than simply writing "verified."

## Make the same evidence reachable from the description

[Plane's Work Item documentation](https://docs.plane.so/core-concepts/issues/overview) describes attaching external URLs through Links. One approach is to keep a brief result in the description and attach a fixed reference to detailed verification records. No such link was added during this research.

A repository's home page alone does little to identify the verification target. In this case, the document path and commit identify the relevant record. If the starting commit and the tested commit differ, label their roles separately.

Development invitation URLs and test accounts do not need to be copied into general explanations. Summarize the relevant result in the ticket and keep execution details in references with appropriate access. This article does not reproduce those details.

## Decide completion from the outstanding criteria

The comparison found that SQN-30 has scope and a stopping point, and Git contains detailed verification records. It also found that the retrieved description alone does not lead to the fixed document revision, and the document still has an outstanding mobile device check.

This research therefore does not justify changing the work item to Done. A proposed update would add a reference to the verification document and identify the remaining criteria. Neither that update nor device verification was performed here.

The handoff contains existing evidence and acceptance criteria that still lack an answer. The next person can use those records to select the remaining work.
