---
title: "Reviewing AI-generated code by breaking one invariant and reading the failing test"
published: false
description: "A controlled mutation of a real notification router shows what its tests protect, and what their passing result cannot prove."
tags: ai, testing, javascript, programming
canonical_url: https://zenn.dev/hirodeath/articles/ai-code-review-invariants
---

An AI assistant returns a diff and tests, and every test passes. The awkward moment comes when you still cannot explain, in your own words, what those tests protect.

One review technique is to choose an invariant, deliberately break it, and check whether a test fails. The failing expectation points to the condition it protects in the implementation.

For this article, SquadNote's real notification router and existing tests were extracted into a temporary copy. Removing one deletion condition changed the result from eight passing tests to seven passing tests and one failure. The check ran on September 11, 2026, using Node.js `v24.15.0` and Vitest `4.1.4`.

This experiment does not establish who wrote the code. It presents a review procedure that also applies to code received from an AI assistant. It describes the procedure tested here, without claiming benefits from continued use.

## Turn “logout works” into a condition about stored data

The example deletes a device's push token. Consider a device that switches from account A to account B, followed by a delayed deregistration request from A.

“Logout works” leaves too much room for interpretation. The invariant here is:

> A request from former owner A must not delete a device token that has moved to B.

This identifies the actor, the target, and the data that must survive. It translates into a test more readily than “handle authorization correctly.”

The relevant deletion predicate is:

```ts
and(
  eq(pushTokens.userId, ctx.session.user.id),
  eq(pushTokens.token, input.token),
)
```

The token must match, and its current owner must match the session user. Registration and ownership transfer form a larger topic; this review stays focused on the deletion predicate.

## Write the counterexample before changing the code

Start with the sequence of operations:

1. A registers `ios-1` and `android-1`.
2. B registers `android-1`, transferring that token's ownership to B.
3. A requests deregistration of `android-1`.
4. B's `android-1` and A's `ios-1` must remain.

The [existing test](https://github.com/takahiro-saeki/circle-hub/blob/0cda1e865ad80d1529197729d8d436e96d56edc7/apps/web/src/security/push-token-privacy.test.ts) already follows this sequence. It reads the database rows afterward instead of merely checking whether an API was called. Its final expectation is:

```ts
expect(await rows()).toEqual([
  { user_id: "user-b", token: "android-1", platform: "android" },
  { user_id: "user-a", token: "ios-1", platform: "ios" },
]);
```

It also matters where `rows()` reads from. These tests use the actual router and a libSQL test database, with external HTTP mocked. If `unregisterPushToken` itself were replaced by a mock that always succeeded, the test would not exercise this predicate.

## Remove only the user condition

The experiment extracted commit `0cda1e8` into a temporary directory and ran the original tests. It then changed the predicate, only in that copy, to:

```ts
eq(pushTokens.token, input.token)
```

This is an injected fault for examining the tests. It is not a proposed production change. Deleting by token alone should allow A's stale request to remove B's registration.

| Code | Passed | Failed | Observation |
| --- | ---: | ---: | --- |
| Original deletion predicate | 8 | 0 | Existing expectations hold |
| User condition removed | 7 | 1 | Deregistration after account transfer is detected |

The failing test was the one asserting that switching accounts transfers only that device and that the previous owner cannot delete it. Its expectation about the stored rows no longer matched.

A test that was already failing would not establish this difference. A syntax error that prevented the suite from starting would not establish that the intended invariant was detected either. Here, the failure occurred at the test's data expectation.

The [experiment script](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/mutation-check.mjs) extracts the fixed commit, runs the baseline, removes the condition, and runs the tests again without modifying the original repository. With the source project's dependencies already installed, run it from the article repository:

```bash
node experiments/article-stock-2026-09/mutation-check.mjs ../circle-hub-multi-device-push
```

## What to inspect if the test still passes

This counterexample was detected. If a different mutation leaves a suite green, first check whether the counterexample reaches the intended code before adding more tests.

For example, a mock that always supplies user A cannot establish a transfer to B. An assertion that checks only a successful response, without reading the rows afterward, can miss excessive deletion. The test might also exercise a different router from the one you changed.

Read the input setup, the invoked function, the mocks at external boundaries, and the final expectations in that order. Once you know which components actually run, add the missing counterexample.

This procedure establishes that a chosen test detects a chosen fault. It does not prove the absence of every authorization bug, every problematic concurrent ordering, or failures in delivery to a real device. This experiment did not use external delivery or physical devices.

When asking an AI assistant for an explanation, “Which data would disappear if this condition were removed, and which expectation would fail?” produces an answer you can compare with execution. Record the invariant, the counterexample, and the expectation that actually failed. That record helps the next reviewer decide whether the same condition can be removed during a cleanup.
