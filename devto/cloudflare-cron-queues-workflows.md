---
title: "Choosing Cron Triggers, Queues, or Workflows by where recovery should resume"
published: false
tags: [cloudflare, architecture, distributed, backend]
canonical_url: https://zenn.dev/hirodeath/articles/cloudflare-cron-queues-workflows
---

A daily report, a call to an external API, and a process waiting for approval are all background work. Combining them under one mechanism can obscure what should be repeated after failure.

Cron Triggers handle when work starts, Queues handle messages being delivered, and Workflows handle stages of a process with intermediate state. Choose by the unit of recovery as well as execution duration.

Official documentation was checked on September 11, 2026. The reporting and approval flow below is a design example. No production triggers, queues, or workflows were created.

## Describe the unit of retry in one sentence

Consider a daily participation report for several organizations. Separate the initial requirement from later additions:

| Requirement | Desired recovery unit | Mechanism to consider |
| --- | --- | --- |
| Start a short report every morning | The report for that day | Cron Triggers |
| Process organizations independently and retry only some | A message identifying the organization and reporting date | Queues |
| Wait for review after reporting, then continue if approved | The unfinished step of the overall process | Workflows |

These are not mutually exclusive choices. A time trigger can start message delivery, with only the jobs that need it entering a multi-stage process.

All three are not necessarily needed from the beginning. A short one-shot report requires different state from a process with per-organization delivery and approval waits.

## Cron Triggers take responsibility for when work starts

The [Cron Triggers documentation](https://developers.cloudflare.com/workers/configuration/cron-triggers/) describes invoking a Worker's scheduled handler using cron expressions, with times interpreted in UTC.

For a daily report, decide the reporting date separately from the start time. If execution crosses a date boundary or a previous day's job is repeated, the intended reporting period should not change accidentally.

The design could use a business job identifier like:

```text
daily-summary / organization-red / 2026-09-11
```

This is a business identity example, not a trigger configuration. Decide whether rerunning the same date is the same job or a revised report with a new version.

Installing a Cron Trigger does not itself represent “red finished, blue remains incomplete.” If a short batch remains sufficient, store those outcomes in a database or another record and define which portions can be repeated.

## Queues define which message receives a retry

When organizations should be processed independently, a message can become the delivery unit. Attach the needed parameters to the identity above.

[Queues' delivery guarantee](https://developers.cloudflare.com/queues/reference/delivery-guarantees/) is at-least-once. A message may arrive more than once, so received-message counts and business-operation counts are different.

The [ack and retry documentation](https://developers.cloudflare.com/queues/configuration/batching-retries/) describes acknowledging individual messages so that an ensuing batch failure does not redeliver those already acknowledged. Individual retry requests redelivery for that message. A successful consumer return also provides automatic acknowledgement.

Suppose a batch contains jobs for red, blue, and green, but only blue encounters an external API failure:

```text
red:   saved successfully → ack
blue:  temporary failure → retry
green: saved successfully → ack
```

The proposed handling records which jobs succeeded and returns the failed job for redelivery. However, if the API succeeded but its response was lost, a retry can still repeat an external side effect. Acknowledgement controls message delivery; it does not make the external operation happen exactly once.

Decide where jobs go after retries are exhausted. If using a dead-letter queue, assign responsibility for inspecting and redriving it. This investigation did not create or execute a consumer or DLQ.

## Workflows represent completed stages and waiting

A process that waits for an administrator after generating a report needs more than a standalone message. It needs to represent completed work, the condition being awaited, and what will resume execution.

[Workflows' sleep and retry documentation](https://developers.cloudflare.com/workflows/build/sleeping-and-retrying/) describes steps, retries, and waits. The [event-waiting API](https://developers.cloudflare.com/workflows/build/events-and-parameters/) also provides `waitForEvent()` for a specified event type.

A proposed flow could be:

```text
Finalize the report for organization red and the reporting date
Save the result for review
Wait for an approval event
Validate the approval and continue
Record the outcome
```

Putting report generation, external transmission, and a subsequent save into one step broadens the work repeated when the later operation fails. Step boundaries determine retry boundaries.

The [Rules of Workflows](https://developers.cloudflare.com/workflows/build/rules-of-workflows/) also call for idempotent API and binding operations because a step can run repeatedly. Moving code into a Workflow does not automatically deduplicate external sends.

An approval wait needs a deadline and an expiration policy. The end of a wait without approval must not be interpreted as approval. Authenticating the sender and checking that the event applies to the correct job remain application responsibilities.

## Preserve business identity when combining the mechanisms

A possible architecture as requirements grow is:

```text
Cron: choose the reporting date and start
  ↓
Queues: deliver each organization's job
  ↓
Workflows: handle jobs needing waits or multiple stages
```

A record that the daily trigger ran does not reveal whether a particular organization's job is still awaiting approval. Conversely, a completed Workflow does not establish that jobs were created for every organization expected that day.

Keep the reporting date, organization, and job ID connected, then compare the expected job set with completed jobs. Unconditionally creating new IDs on redelivery or restart makes duplicate business work harder to trace.

This architecture also adds delivery configuration, step state, and logs to investigate. Throughput and cost were not compared, so this article does not claim that combining the mechanisms improves efficiency.

## Plan partial failures before testing the rollout

At an actual rollout, separately test at least an isolated organization failure, a lost response after a save, and an approval that never arrives. These are proposed checks for the target environment, not tests executed in this investigation.

They examine delivery granularity, idempotency, and waiting-state deadlines respectively. Reducing all of them to “the batch failed” loses the information needed to choose a restart point.

Start by defining the unit of work that can be repeated. A timed invocation may suffice; other work needs per-message redelivery or preserved progress while waiting for the next stage. Add components according to that distinction.
