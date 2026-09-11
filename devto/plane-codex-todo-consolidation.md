---
title: "Consolidating Codex TODOs in Plane without merging different deliverables"
published: false
description: "Existing tickets and Git records show why matching themes are not enough to identify duplicate work."
tags: [plane, productivity, ai, webdev]
canonical_url: "https://zenn.dev/hirodeath/articles/plane-codex-todo-consolidation"
---

Suppose a TODO to explain joining a group through an invitation link appears in more than one conversation. Merging it into an existing ticket because the title sounds familiar could combine a carousel and a video into one task.

Consolidation works better when it identifies the target and deliverable. The same theme can require separate outputs. If a conversation continues existing work, decide where its new assumptions and remaining tasks belong.

This record compares SquadNote's Plane tickets with fixed Git documents on September 11, 2026. Some descriptions retain a Codex chat date. It is not an experiment in automatically extracting tasks from complete conversations, and no tickets were created or merged during the audit.

## Separate matching themes by their deliverables

The production records include parent `SQN-46` and children `SQN-47` and `SQN-48`. Their abbreviated scopes differ as follows.

| ID | Subject | Deliverable | Relationship |
| --- | --- | --- | --- |
| SQN-46 | Instagram publishing series | Theme management and ongoing operation | Parent |
| SQN-47 | Joining through an invitation link | Five carousel images, HTML/CSS, caption, alt text | Static version |
| SQN-48 | The same joining guide | Vertical MP4, editable source, scene images, subtitles, cover | Video version |

Both children cite Codex chat 2026-09-09, and the video refers to the static version. Their shared theme reflects adaptation to another format, rather than duplicate work.

The Git records preserve the same relationship. The [static README](https://github.com/takahiro-saeki/circle-hub/blob/e295f5cedf9f8989b36c9f308dee4dbd8cf64c3f/docs/marketing/instagram/001-invite-join/README.md) links back to `SQN-47`, and the [video README](https://github.com/takahiro-saeki/circle-hub/blob/e295f5cedf9f8989b36c9f308dee4dbd8cf64c3f/docs/marketing/instagram/001-invite-join/video/README.md) links to `SQN-48`. The audit also read the initial production commit `560e752`, the audio-preview commit `afcf45f`, and the later operating documentation in `e295f5c`.

Combining the two would make a single Done state unable to express that the images are ready while the video's subtitles still need work. When wording recurs across conversations, compare the outputs first.

## Preserve execution conditions in related parent and child tasks

Another pair, `SQN-14` and `SQN-27`, both concern removing a legacy Turnstile compatibility bypass. Their distinction is an execution condition rather than a media format.

`SQN-14` describes checking adoption of the updated app before removing the compatibility code. Its child, `SQN-27`, specifies final removal after reviewing legacy usage on or after 2026-09-10. The retrieved `parent` relationship matched the description.

Discarding the later TODO merely because both say "remove the old code" would lose the condition about allowing time for update notices to reach users. Treating them as independent implementation tasks could instead duplicate the same deletion.

The parent can be read as the background and overall conditions, with the child specifying when to execute. Both were Done when retrieved, but production logs and behavior after removal were not rechecked. The state is an observed field; correctness of the code removal requires separate evidence.

## Reduce a candidate to one line before importing it

Before creating a ticket from a conversation, rewrite its candidate task in this form:

```text
Service / Target of the change / Deliverable / Condition for accepting it
```

For the joining guide, that becomes "SquadNote / invitation guidance / vertical video / current flow, subtitles, and visuals agree." Search existing tickets with that description, then read their bodies and relationships rather than only their titles.

A proposed way to handle the matches is:

- If target, output, and acceptance conditions match, collect the additional information in the existing ticket.
- If the theme matches but the output differs, retain a separate related task.
- If it is an independently verifiable part of a larger plan, consider a parent-child relationship.
- If it changes a completed deliverable, retain the reason and target version before deciding whether to reopen the work or create a follow-up.

Text similarity can help locate candidates. It cannot reliably establish that subtitle acceptance conditions or a rollout prerequisite match.

When several conversations contribute to one candidate, append their dates and relevant decisions instead of replacing the source with the latest one. This does not require copying complete chats into the description. Leave out secrets and verification invitation URLs, and retain the information needed to follow the decision.

## A Done state can hide later preparation work

`SQN-48` was Done at retrieval time. The fixed Git [publication review](https://github.com/takahiro-saeki/circle-hub/blob/e295f5cedf9f8989b36c9f308dee4dbd8cf64c3f/docs/marketing/instagram/001-invite-join/video/publication-check.md) still records work such as generating publication audio, synchronizing subtitles to speech, and verifying actual interactions.

Those two observations do not prove the original ticket was closed incorrectly. Its scope may have changed between initial production and later publication preparation. They do show that Done alone is insufficient evidence that the latest asset is ready to publish.

During consolidation, check for subsequent changes before treating a completed ticket as requiring no action. In this example, a handoff candidate can retain:

```text
Sources: The video ticket and publication review at a fixed commit
Existing assets: A silent preview master and editable production sources
Remaining work: Publication audio, subtitle synchronization, interaction and posting checks
Completion evidence: Final-version verification and a publication record after approval
```

This is a handoff example derived from the records, not a newly created ticket. The audit did not publish anything or generate paid media.

Consolidating conversation TODOs means identifying which existing deliverable should advance, and from which recorded state. In this case, the static and video outputs needed to remain distinct, while the latest Git document supplied the remaining publication preparation work.
