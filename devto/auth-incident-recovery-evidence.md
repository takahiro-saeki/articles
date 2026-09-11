---
title: "Verify authentication recovery before treating Configuration as the root cause"
published: false
tags: [authentication, nextjs, testing, debugging]
canonical_url: https://zenn.dev/hirodeath/articles/auth-incident-recovery-evidence
---

A return URL containing `error=Configuration` suggests a configuration mistake. Yet the inspected Auth.js version also produces that destination when a PKCE cookie is missing. The user-facing classification does not identify the cause by itself.

This investigation read SquadNote's recovery implementation and reran tests against its actual Auth.js dependency. It examines rejection, retry navigation, and diagnostic evidence before drawing a causal conclusion.

The source is `circle-hub` at `d116e8a`, checked on September 11, 2026. No production authentication logs or user histories were collected. This is an account of recovery code and rerun verification, not proof of a production incident's cause or resolution.

## Distinguish the internal error from Configuration

[Auth.js's InvalidCheck reference](https://authjs.dev/reference/core/errors#invalidcheck) covers PKCE, state, or nonce checks that cannot be performed. Unavailable cookies can produce it, as can configuration issues.

The [repository regression test](https://github.com/takahiro-saeki/circle-hub/blob/d116e8a343e8d9e7ddd3d1985efe590fa1901868/apps/web/src/server/auth/auth-core-recovery.test.ts) resolves `@auth/core` through the application's `next-auth` dependency. It does not substitute a separately installed latest release.

A synthetic callback without its PKCE cookie produced:

| Observation | Result |
| --- | --- |
| HTTP status | 302 |
| Redirect destination | `/sign-in/error?error=Configuration` |
| Internal type passed to the logger | `InvalidCheck` |

The fixture deliberately omitted the cookie, so its cause is known. Seeing the same internal type in production would still require investigating why the cookie did not arrive. Expiration, another initiation, and browser behavior cannot be distinguished from that display alone.

## First restore a path from failure to a fresh start

The [recovery design record](https://github.com/takahiro-saeki/circle-hub/blob/d116e8a343e8d9e7ddd3d1985efe590fa1901868/docs/auth-recovery-diagnostics.md) and history show the recovery screen in `061a5f2`, repeated-submission protection in `2b88c31`, and diagnostics in `7f180ad`.

The recovery screen presents sign-in and public help without depending on `auth()` or the database. Displaying an authentication failure does not require successfully repeating the same authentication dependency.

Return destinations are restricted to safe paths on the same origin. Tests preserve invitation-page returns while rejecting external redirection and authentication-page loops. The original callback URL is not reused unconditionally.

Two new initiation requests sent to the actual Auth.js implementation produced different PKCE challenges, `S256`, and fresh PKCE cookies. However, the initiation fixture uses the internal CSRF-skip option. It does not verify browser CSRF protection or a round trip through the OAuth provider, and no production setting was changed to disable CSRF checks.

## Reject a second start before React rerenders

Disabling a button visually can leave a window before React rerenders in which another button can be pressed. The implementation uses a synchronous guard shared by Google and Apple initiation on the same screen:

```ts
export function createSubmissionGuard() {
  let submitting = false;
  return {
    acquire() {
      if (submitting) return false;
      submitting = true;
      return true;
    },
    reset() { submitting = false; },
  };
}
```

Tests against the [actual guard](https://github.com/takahiro-saeki/circle-hub/blob/d116e8a343e8d9e7ddd3d1985efe590fa1901868/apps/web/src/app/sign-in/submission-guard.ts) reject immediate reacquisition, allow acquisition after the reset used for failure or history restoration, and keep separate instances independent.

Its scope is repeated submission from one screen. It does not serialize initiation across tabs or browsers, nor remove every possible cause of missing cookies.

## Correlate how far the flow progressed

The diagnostics investigate initiation and callback boundaries without storing authentication values. The principal events mean:

| Event | What it establishes |
| --- | --- |
| `auth.sign_in_started` | A start request occurred |
| `auth.authorization_redirect` | Initiation generated a destination |
| `auth.callback_received` | A callback arrived |
| `auth.sign_in_succeeded` | Auth.js emitted its signIn event |
| `auth.server_error` | Failure and diagnostic information were recorded |

Initiation and destination generation do not mean authentication succeeded. In particular, the server action's `cookiesAfterStart` observes the cookie jar at that time. Existing cookies can be present, so presence alone does not establish fresh issuance.

`requestId` identifies a failing request; `attemptId` supports correlation with initiation. The latter marker is client-originated diagnostic information and does not authorize authentication. It represents the browser's most recent initiation, so it does not prove the same OAuth transaction across multiple tabs.

Absent, expired, or provider-mismatched markers can prevent correlation. Record why correlation failed instead of rephrasing that as “no initiation happened.”

## Add diagnostics without weakening authentication checks

Diagnostic tests verify that synthetic sensitive values, including cookie values, authorization codes, tokens, raw User-Agent strings, and IPs, do not appear in logs. Cookie observations retain only presence for specific names, and paths are restricted to authentication routes.

Tests also check isolation between concurrent requests, preservation of authentication responses when diagnostics or notifications fail, and preservation of the original Auth.js response cookies. The change does not obtain successful logins by relaxing PKCE, state, or nonce requirements.

Alert suppression operates within a Worker instance; it is not a delivery guarantee across all distributed instances. The diagnostic cookie is not a session replacement either. Neither mechanism belongs in the decision that authentication has succeeded.

## The 47 tests and the remaining environment checks

The run passed 47 tests across 8 files copied from the fixed commit. It used Node.js `v24.15.0`, Vitest `4.1.4`, Next.js `15.5.15`, next-auth `5.0.0-beta.25`, and its Auth.js core dependency `0.37.2`. The [runner](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/batch05-circle-tests.py) and [results](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/production/2026-09/batch-05/auth-tests.json) are preserved.

Some tests invoke the actual Auth.js implementation; others mock route or notification dependencies. Real Google or Apple accounts, Safari or embedded browsers, multiple tabs, and manual browser-cookie deletion were not tested in this run. Historical UI verification documented in the repository is also separate from these rerun results.

Verify the failure classification, fresh initiation, safe return destination, same-screen repeat protection, and the limits of log correlation in order. While the cause remains uncertain, record the conditions for retry and the questions requiring further investigation.
