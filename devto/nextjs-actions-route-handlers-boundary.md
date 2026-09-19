---
devto_id: 4689753
title: "Choose Next.js Server Actions or Route Handlers by the contract with the caller"
published: true
description: "A real account-linking form and a cron endpoint illustrate where UI actions end, HTTP contracts begin, and authorization must still happen."
tags: nextjs, react, typescript, webdev
canonical_url: https://zenn.dev/hirodeath/articles/nextjs-actions-route-handlers-boundary
---

When writing a server-side mutation in Next.js, the same business logic can appear to fit inside either a Server Action or a Route Handler. Memorizing “Actions for forms, Routes for APIs” becomes less helpful when a mobile app or a cron job needs to invoke it too.

The choice starts with the contract you want to give the caller. An Action is a candidate when the operation belongs to a Next.js screen, including its navigation flow. A Route Handler fits when you want to explain a URL, HTTP method, authentication header, and JSON result to another caller.

SquadNote's form and cron endpoint provide concrete examples. The inspected source is commit `0cda1e8`, with Next.js `15.5.15` and React `19.2.5` installed locally. The official documentation consulted on September 11, 2026, displayed version `16.3.4`. The current documentation and the version actually tested are recorded separately.

## The form passes the authentication operation and return destination together

The [account-linking screen](https://github.com/takahiro-saeki/circle-hub/blob/0cda1e865ad80d1529197729d8d436e96d56edc7/apps/web/src/app/%28app%29/settings/_components/linked-accounts.tsx) contains code equivalent to this shortened excerpt:

```tsx
<form
  action={async () => {
    "use server";
    await signIn(p.id, { redirectTo: "/settings" });
  }}
>
  <button type="submit">Connect</button>
</form>
```

Styling and other button details are omitted. Here, `p` is an authentication provider enumerated by the screen. The form starts that provider's authentication flow and specifies a return destination appropriate for the screen.

This Action is the entry point for a screen operation. It does not need to define a JSON format for a separate client.

The official [Mutating Data guide](https://nextjs.org/docs/app/getting-started/mutating-data) describes a Server Function used in a form or mutation context as a Server Action. Its transport uses POST, and it can also receive direct POST requests outside the application's UI. A button being visible only on one screen does not make that screen's permission check sufficient.

The excerpt starts authentication; it is not an authorization template for arbitrary mutations. Replacing it with post deletion, for example, requires checking the acting user and their relationship to the post.

## The cron endpoint has HTTP results to return

The [morning notification route](https://github.com/takahiro-saeki/circle-hub/blob/0cda1e865ad80d1529197729d8d436e96d56edc7/apps/web/src/app/api/cron/morning-reminder/route.ts) exports `POST(request: Request)`. Its sequence is:

```text
POST /api/cron/morning-reminder
  Read the configured secret
  Missing configuration → 500
  Authorization header mismatch → 401
  Query today's schedules
  Send push notifications if there are recipients
  Return a JSON result
```

The cron caller needs to know which method to use, which header to attach, and which result to expect. Passing a function to a form is not its interface. A [Route Handler](https://nextjs.org/docs/app/getting-started/route-handlers), built around the Web Request and Response APIs, fits that need.

For the same reason, defining an HTTP contract helps when an endpoint will serve mobile apps or external services. Choosing a Route Handler does not, by itself, specify authentication or the behavior of repeated requests.

## Verify that rejected requests stop before database access

The route from the fixed commit was extracted into a temporary directory, and its exported `POST` function was invoked directly. Database access and push delivery were mocked to check that execution stopped before reaching them when authentication conditions were unmet.

| Input | Status | Database accessor | Push delivery |
| --- | ---: | --- | --- |
| No configured secret | 500 | Not called | Not called |
| Secret configured, header absent | 401 | Not called | Not called |
| Secret configured, header mismatched | 401 | Not called | Not called |
| Matching header, mocked query returns zero schedules | 200 | Called | Not called |

All four tests passed on Node.js `v24.15.0`, Vitest `4.1.4`, and Next.js `15.5.15`. The [verification script](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/next-route-entry.mjs) accepts the source repository with its dependencies already installed:

```bash
node experiments/article-stock-2026-09/next-route-entry.mjs ../circle-hub-multi-device-push
```

This exercises the actual route function without starting a Next.js HTTP server. It uses the local environment-variable fallback. Cloudflare binding access, cron triggering, network requests, and real notification delivery are outside the test. The four cases do not test the Action transport either.

Even within that scope, invoking the entry point makes its conditions for reaching business logic observable. A test that checks only a 200 response would not reveal a missing rejection branch.

## Reuse the logic behind the entry points

Suppose the same mutation later needs to serve both an admin screen and a mobile app. Instead of treating the Action as the external client's API specification, consider separating the common business function from its entry points:

```text
Admin UI → Action → Session check ─┐
                                 ├→ Resource permission and input checks → Mutation
Mobile   → Route → API auth ──────┘
```

This is a proposed structure, not a refactoring completed on SquadNote's two entry points. The common function can receive an actor verified by server code or obtain the actor itself. A `userId` supplied in form data or JSON must not become a trusted actor merely because it was passed to that function.

If business authorization moves into the shared layer, every entry point must pass through it. The Action can retain form conversion and UI updates; the Route can retain HTTP input conversion and status selection.

The official [Data Security guide](https://nextjs.org/docs/app/guides/data-security) also explains that a page-level authentication check does not extend to Actions defined inside the page. It shows authentication and authorization centralized in a data access layer invoked by the Action. A `use server` directive alone does not verify permission to operate on a resource.

Before choosing an entry point, write down the caller, credentials, input, and success and failure results. Choose an Action when these fit naturally into a screen operation, or a Route Handler when they need an independent HTTP contract. If reuse becomes necessary, extract the business logic while preserving those contracts.
