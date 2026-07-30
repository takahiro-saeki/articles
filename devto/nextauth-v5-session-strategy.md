---
devto_id: 4272210
title: "NextAuth v5 sessions: JWT or database? Untangling the adapter-driven switch with a production config"
tags: nextauth, nextjs, typescript, authjs
canonical_url: https://qiita.com/hiro123/items/1d7f5eef89dc27f64f0b
published: true
---

> This is a translation of my original article in Japanese: [Qiita](https://qiita.com/hiro123/items/1d7f5eef89dc27f64f0b)

I run NextAuth (Auth.js) v5 in two indie products (web + iOS). They work, but for a long time I could not have answered a simple question: is my session a JWT or a database row?

After digging in, it turns out there are really only two rules to remember:

- The session strategy switches implicitly based on whether you configured an adapter (none = `jwt`, present = `database`)
- The Credentials provider does not create database sessions, so it requires an explicit `strategy: "jwt"`

This post walks through where these two rules bite, using the config I actually run in production.

## Familiar symptoms

Have you ever ended up in one of these states with NextAuth?

- You followed a tutorial, it works, but you cannot say where the session is stored
- Some articles use `token` in the `session` callback and others use `user`, and you are not sure which is correct
- You added a Credentials provider and login succeeds, but no session comes back

All three are explained by the two rules above.

## Background: there are two session strategies

| | `jwt` strategy | `database` strategy |
|---|---|---|
| The session itself | An encrypted JWT (JWE) in the cookie | A row in the sessions table |
| Cookie contents | An encrypted token carrying claims | A random session token (a DB reference key) |
| Server-side lookup | None (just decryption) | A DB query per request |
| Instant revocation (force logout) | Hard | Delete the row |
| `session` callback receives | `{ session, token }` | `{ session, user }` |

The important part is how the default is decided. If you do not specify anything:

- **No adapter → `jwt`**
- **Adapter present → `database`**

In other words, the moment you wire up DrizzleAdapter, your session storage quietly moves from the cookie to the database. If you do not notice and copy an older tutorial's callback, you will be staring at an undefined `token` wondering what happened.

## Credentials is the exception

The other trap is the Credentials provider. Logging in via Credentials does not create a database session. With an adapter configured (which defaults you into the database strategy), Credentials login authenticates fine but no session is stored: you are "logged in but not logged in".

The fix is to set `session: { strategy: "jwt" }` explicitly. Note that this is a global setting affecting all providers, so "OAuth on DB sessions plus Credentials alongside" is not straightforward.

## How I use both in production

My product uses this constraint to its advantage:

- Production: Google / Apple OAuth only → database strategy (the default, untouched)
- E2E tests and local dev only: a test-login Credentials provider is enabled → switch to jwt

Here is the actual config, abbreviated:

```ts
export function getAuthConfig(env?: { ENABLE_TEST_LOGIN?: string /* ... */ }): NextAuthConfig {
  const enableTestLogin = env?.ENABLE_TEST_LOGIN === "true";

  const providers: NextAuthConfig["providers"] = [
    Google({ /* ... */ }),
    Apple({ /* ... */ }),
  ];

  if (enableTestLogin) {
    providers.push(
      Credentials({
        id: "test-login",
        async authorize(credentials) { /* returns a test user */ },
      }),
    );
  }

  return {
    providers,
    adapter: drizzleAdapter, // its mere presence makes database the default
    // Credentials provider requires the JWT session strategy
    session: enableTestLogin ? { strategy: "jwt" } : undefined,
    callbacks: {
      // the session callback's partner changes with the strategy
      jwt: enableTestLogin
        ? ({ token, user }) => {
            if (user) token.id = user.id; // user is only present right after sign-in
            return token;
          }
        : undefined,
      session: enableTestLogin
        ? ({ session, token }) => ({
            // jwt strategy: no DB lookup, restore from the token
            ...session,
            user: { ...session.user, id: (token as { id?: string }).id ?? "" },
          })
        : ({ session, user }) => ({
            // database strategy: the user joined from the sessions table comes in
            ...session,
            user: { ...session.user, id: user.id },
          }),
    },
  };
}
```

Three things this config leans on:

1. `session: enableTestLogin ? { strategy: "jwt" } : undefined` — passing undefined hands the decision back to the default branching (adapter present = database)
2. The `jwt` callback is only needed under the jwt strategy. `user` is passed exactly once, right after sign-in; on every later request you only have what you wrote into the token
3. The `session` callback receives different arguments per strategy, so supporting both means writing both variants. The types make it look like `token` and `user` are always available; which one is actually populated depends on the strategy

## How to check which strategy you are on

Two things tell you immediately:

1. Does your sessions table grow when you log in? If yes, database strategy
2. What is in the session cookie (`authjs.session-token`)? A long `eyJ...` token (JWE) means jwt; a short random string is a database reference token

If you run Drizzle + D1, something like `wrangler d1 execute <db> --command "select * from session"` does the job.

## Summary

| Situation | Strategy | What to do |
|---|---|---|
| No adapter | jwt (default) | Handle `token` in jwt/session callbacks |
| Adapter, OAuth only | database (default) | Use `user` in `session({ session, user })` |
| Using Credentials | jwt required | Set `strategy: "jwt"` explicitly; DB sessions unavailable |
| OAuth on DB, Credentials for tests only | Switch per environment | This article's config (env-driven strategy and callbacks) |

"The adapter flips the strategy" and "Credentials requires jwt". Once I had these two pinned down, the number of times I squinted at session code dropped noticeably.

## Environment

- next-auth 5.0.0-beta.25 / @auth/drizzle-adapter 1.7.x
- Next.js 15 (App Router) + Drizzle ORM + Cloudflare D1 (@opennextjs/cloudflare)
