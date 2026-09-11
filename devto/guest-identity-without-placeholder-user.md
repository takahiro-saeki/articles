---
title: "Claim guest responses by transferring control of a record, not matching a name"
published: false
tags: [authentication, architecture, typescript, webdev]
canonical_url: https://zenn.dev/hirodeath/articles/guest-identity-without-placeholder-user
---

Someone answers an event invitation without logging in and later wants to change the response. Using their name as proof of identity cannot distinguish namesakes or a different person logging in on a shared device.

SquadNote issues a token controlling one response instead of creating a placeholder user row. Later login does not automatically match names: the person reviews the target responses and explicitly claims them for the account.

A response token grants control of a record; identifying a person requires separate evidence. This investigation read the design, migration, API, and device-storage code at `circle-hub` commit `9aec489`, then reran related tests on September 11, 2026.

## Add response ownership before building an organization roster

The [design document](https://github.com/takahiro-saeki/circle-hub/blob/9aec48963842dcaf16ce49c80317366509ab1b8f/docs/growth/09-guest-response-ownership.md) separates adding control to existing `guest_attendance` records from a future organization-level provisional membership feature.

The implemented stage is the former. Ownership belongs to an event response, supporting listing, editing, and account claiming without treating a matching name as proof of identity.

The [migration SQL](https://github.com/takahiro-saeki/circle-hub/blob/9aec48963842dcaf16ce49c80317366509ab1b8f/apps/web/migrations/0007_add_guest_response_ownership.sql) adds these columns:

| Column | Purpose |
| --- | --- |
| `ownership_token_hash` | Hash used to verify unauthenticated control of the response |
| `claimed_by_user_id` | Account that claimed it |
| `claimed_at` | Claim time |
| `attending_since` | Time the response became attending |
| `updated_at` | Update time |

Existing responses do not receive ownership tokens retroactively. Matching a name does not grant control over past responses. How preexisting rows participate in a new feature is part of the migration contract.

## Separate the response ID from its operation token

The response ID locates the target. It does not authorize editing by itself; the token returned when the response was created must also be verified.

The [token implementation](https://github.com/takahiro-saeki/circle-hub/blob/9aec48963842dcaf16ce49c80317366509ab1b8f/apps/web/src/server/api/lib/guest-response-ownership.ts) generates 32 bytes with `crypto.getRandomValues()` and represents them as 43 base64url characters. Only the SHA-256 hash enters the database. The [Web Crypto specification](https://www.w3.org/TR/webcrypto/#Crypto-method-getRandomValues) defines that method as a source of cryptographically strong random values.

This creates a string granting control. It does not prove that its holder is the person named in the response. The model permits whoever holds a valid token to operate on that record.

Keeping plaintext out of the database prevents simply replaying the stored hash as the operation key. It does not remove the need to protect the original token on the client.

## Losing storage can remove control without deleting the response

The implementation stores response IDs and tokens in Web `localStorage` and mobile `SecureStore`. Tokens are kept out of URLs; the necessary references are sent to listing and mutation APIs.

Web storage parsing discards malformed rows and returns an empty array if reading fails. That prevents a crash. It does not establish that no database responses exist or recover the person's responses.

The saved-reference limit is 100. Clearing storage, opening another device, or dropping an old reference beyond that limit has no implemented name-based recovery path. Automatic cross-device synchronization is also outside this stage.

As [OWASP's localStorage guidance](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html#local-storage) explains, JavaScript-readable storage is exposed to XSS. Placing these values in localStorage does not make them secure by itself. This investigation did not audit the application's complete XSS defenses or storage on physical devices.

## Claim after login and confirmation, then remove the old key

After login, the screen displays locally saved responses and calls the claim API only through an explicit action. Logging another account into a shared device does not automatically attach those responses to it.

After checking the authenticated account and token, the [claim API](https://github.com/takahiro-saeki/circle-hub/blob/9aec48963842dcaf16ce49c80317366509ab1b8f/apps/web/src/server/api/routers/attendance.ts) updates:

```ts
.set({
  claimedByUserId: ctx.session.user.id,
  claimedAt: new Date(),
  ownershipTokenHash: null,
})
```

This is the update object excerpted from the implementation. Surrounding code checks the session, existing claimant, and token. The update condition also retains the response ID, an unset claimant, and the original token hash. Filtering is therefore present at the write as well as during the preceding check.

Only successful IDs are removed from device storage. Subsequent access uses the logged-in user's ID. Rejecting reassignment to another account and clearing the old token hash define the transfer of control.

The API processes multiple responses sequentially and returns `claimedIds` and `rejectedIds`. The client must not treat the whole list as successful and delete every reference. Separate results preserve which records actually transferred when some were rejected.

## What the 15 rerun tests covered

All 15 tests in 3 related files passed from the fixed commit. The run used Node.js `v24.15.0` and Vitest `4.1.4` in a temporary copy, without changing the original working directory.

| Target | Checked behavior |
| --- | --- |
| Token functions | Encoding, different generated values, correct hash verification |
| Response API | Wrong-token rejection, valid references, ownership data omitted from public output |
| Visibility | Responses for an event made private are omitted from the locally saved list |
| Claiming | Reassignment rejection, hash clearing, and the branch that does not report an update as successful after a conflict |
| Web storage | Malformed data, replacement of the same response ID, removal of successful IDs only |

The token functions use the actual randomness and hashing APIs. API tests invoke the actual router but mock the database and notifications. They do not reproduce SQL predicate evaluation or multiprocess races in real D1.

The [runner](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/batch05-circle-tests.py) and [results](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/production/2026-09/batch-05/guest-tests.json) preserve that scope. This run did not exercise SecureStore on physical mobile devices or operate the claiming screen.

## Do not infer personal identity from control of a response

Implemented behavior consists of record-level tokens, management from the same device, and explicit transfer to an account. A provisional organization roster, automatic retrieval of past responses by name, and cross-device synchronization remain separate future features.

Before expanding guest convenience, specify what possession of each credential permits. Keeping control of one response from implicitly granting control of namesakes' responses or roster entries makes the next identity-verification requirement clearer.
