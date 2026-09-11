---
title: "Using estimates to spot overloaded solo projects before predicting dates"
published: false
description: "A read-only audit of Plane Work Points compares task counts, missing estimates, and overlapping parent scope."
tags: [plane, productivity, python, webdev]
canonical_url: "https://zenn.dev/hirodeath/articles/plane-estimate-capacity-experiment"
---

Planning to work on three tasks this week says little about their size. Exploring an email delivery service and implementing a feature across several devices can both count as one task.

This audit compares equal task counts with the Work Points stored in Plane for SquadNote, a personal project. The useful finding was a concentration of large tasks in progress. This experiment did not establish how accurately points predict deadlines, and the total was not converted into days remaining.

On September 11, 2026, the audit retrieved 52 non-archived work items from the personal workspace and verified that there was no next page. The analysis ran on Python 3.14.5. It did not create tickets, change estimates, or update states.

## Read what the points mean first

[Plane Estimates](https://docs.plane.so/core-concepts/issues/estimates) supports numeric points, categories, and time. This project used a numeric scale named `Work Points`, with values `1, 2, 3, 5, 8`.

Its description includes investigation, design, implementation, tests, PR work, distribution, and device verification. These points cover more than writing code. The description also gives rough guides: 5 for half a day to a day, and 8 for one to three days. Those guides are not conversion factors derived from measured work time.

The personal ticketing rules also distinguish unstarted work from partially completed imports: estimate the full scope of the former and the remaining work of the latter. Existing estimates may therefore refer to different starting points. An 8 stored on a ticket does not mean it necessarily requires three more days from today.

The scale prompts a check of the next task's size. Priority remains a separate field. Clearing small tasks first does not necessarily advance the most valuable work.

## Do not silently count missing estimates as zero

The audit checked every item outside the completed and cancelled groups before adding their estimates.

| State group | Items | Sum of stored points | Missing |
| --- | ---: | ---: | ---: |
| Backlog | 11 | 68 | 0 |
| Todo | 5 | 32 | 0 |
| In Progress | 6 | 48 | 0 |
| Total | 22 | 148 | 0 |

There were 12 completed items and one cancelled item without points. They were excluded from this open-work analysis. Summing only the known estimates of completed items would not establish throughput for a period either. The retrieval did not include cycle histories, additions during a cycle, or estimate revisions.

This is the function executed after normalizing the response to `identifier / group / points`. The `group` field contains a value such as `started`, rather than the display name.

```python
def summarize_open(items):
    active = [x for x in items if x['group'] not in {'completed', 'cancelled'}]
    missing = [x['identifier'] for x in active if x['points'] is None]
    if missing:
        raise ValueError(f'Missing points: {missing}')
    if any(x['points'] not in {1, 2, 3, 5, 8} for x in active):
        raise ValueError('Unexpected point scale')
    if len({x['identifier'] for x in active}) != len(active):
        raise ValueError('Duplicate work item')
    return {'count': len(active), 'points': sum(x['points'] for x in active)}
```

The real snapshot passed. Further checks used local copies containing a missing estimate, zero, an out-of-scale value of 13, and a duplicate ID. All four cases stopped the calculation. The function never silently turns a missing estimate into zero.

These checks validate the local analysis. They neither changed Plane's estimation system nor discovered those malformed values in the live workspace.

## Three items can mean 11 points or 24 points

The comparison uses two groups of open items with their existing values unchanged. This is a comparison sample, not an adopted plan for the week.

| Comparison group | Work items and abbreviated scope | Total |
| --- | --- | ---: |
| Three smaller items | SQN-10, explore email delivery: 3; SQN-12, mobile sidebar: 3; SQN-13, add Google account linking: 5 | 11 |
| Three larger items | SQN-9, adoption interviews: 8; SQN-30, trial-participant permissions: 8; SQN-39, platform-specific analytics: 8 | 24 |

Both groups contain three items. Their estimates warrant reading the scope again before putting them into the same planning window. Dividing 24 by 11 would not produce a valid duration ratio. Interviews depend on other people's availability; verification across devices depends on having the devices ready. Waiting and active work differ too.

Another visible pattern was that all six In Progress items had an estimate of 8. Before asking how many more tickets fit, check which of those six are being implemented and which are waiting for verification. Points cannot explain why work has stopped. That requires returning to the description and remaining tasks.

## Parent and child estimates may describe overlapping work

The 148 points are a sum of stored values. They are not necessarily the total of independent remaining tasks.

For example, `SQN-46` is the parent for an Instagram publishing series. Its description says the overall scope exceeds 8 points and should proceed through child tasks. The stored value of 8 is not a precise estimate for the whole series. Adding the parent and every future production task could count some of the same work twice.

Dropping all parents automatically would not necessarily solve this. A parent might also contain coordination or review work that exists nowhere else. Before using a total for planning, establish whether its estimate covers only that work or includes its children. This experiment did not subtract anything automatically; it kept that limitation next to the total.

A new weekly record could separately retain the work selected at the start, work added later, completed work, and carryover. It could also retain the previous value when an estimate changes. That is a proposed recording practice, not a reconstruction of earlier weeks from the current list.

## Use the result to discuss decomposition

This analysis does not establish a weekly point limit. That would require several weeks of consistently recorded available time and completed scope.

It can already help identify an attempt to advance too many large tasks at once. Open an 8-point ticket and make its remaining checks explicit. Distinguish implementation from waiting on someone else. Consider whether a small new task helps finish the larger work already underway. In this snapshot, the six In Progress items provide a starting point for that review.
