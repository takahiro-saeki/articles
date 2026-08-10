---
devto_id: 4355861
canonical_url: https://qiita.com/hiro123/items/4047a643cdf5e769f0bf
title: Testing Cloudflare Cron Triggers Locally for Push Notification Workflows
tags: Cloudflare, CloudflareWorkers, Wrangler, Nextjs
published: true
---

_This article is an English translation of the original Japanese article._

I use Cloudflare Workers Cron Triggers to send push notifications on the morning of practice days. The challenge was figuring out how to verify the entire workflow locally without waiting for the scheduled cron time.

In my implementation, I separate the Worker's `scheduled` event from the HTTP route that handles the notification logic.

## Keep the scheduled handler thin

The Worker receives the cron event and calls an internal route handler.

```ts
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return handler.fetch(request, env, ctx);
  },

  async scheduled(_controller: ScheduledController, env: Env) {
    const request = new Request(
      "https://internal/api/cron/morning-reminder",
      {
        method: "POST",
        headers: { authorization: `Bearer ${env.CRON_SECRET}` },
      },
    );

    await handler.fetch(request, env);
  },
};
```

The key is not embedding date logic, user retrieval, and Expo Push API calls directly inside `scheduled`. Delegating to an HTTP route means the same logic can be triggered over HTTP, making local verification much easier.

## Start Wrangler with scheduled test support

Locally, start Wrangler with the following option:

```bash
npx wrangler dev --test-scheduled
```

Append `/__scheduled` to the URL Wrangler displays.

```bash
curl "http://localhost:8787/__scheduled?cron=0+22+*+*+*"
```

Use the same cron expression in the `cron` query parameter. Cloudflare interprets cron in UTC, so don't write expressions based solely on JST.

## Keep direct HTTP route access as a fallback

When you only want to verify recipient filtering, you can call the internal route directly.

```bash
curl -X POST http://localhost:8787/api/cron/morning-reminder \
  -H "Authorization: Bearer $CRON_SECRET"
```

This route validates `CRON_SECRET`. Rather than removing authentication for local development, I store a development value in `.dev.vars`. Production secrets never go into source control.

## Separate actual sending from recipient extraction

If your local database has no schedules, participants, or push tokens for today, the cron will run but send zero notifications. When testing, verify in order:

1. Does `scheduled` reach the route?
2. Is the date correct after timezone conversion?
3. Are target schedules and participants retrieved?
4. Are users without push tokens filtered out?
5. Are external API results recorded?

The hard part of cron testing is not how to trigger it, but coordinating test data with the current time. Splitting the core logic into an HTTP route lets you verify event wiring and notification logic separately.

## References

- [Cloudflare Workers: Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)
- [Wrangler commands](https://developers.cloudflare.com/workers/wrangler/commands/)
