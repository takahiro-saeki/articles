# Batch 15 Workers fixture

Local workerd and Chromium comparisons for T41 and T43. Service Binding SINK is a Node function with synthetic responses. No Cloudflare resources, deployment or real notifications are involved.

Install locked dependencies in this directory with `npm ci`, then run `npm run typecheck`. From the repository root:

```sh
node experiments/article-stock-2026-09/workers-batch15/run.mjs
```

The script compares awaiting a job, registering a waitUntil job, independent rejection, explicit failure observation, a 35000 ms local gate, and three Cache-Control values. It writes `workers-runtime-experiment.json`, then leaves a server on `127.0.0.1:9916` for browser checks. The local completion after 35 seconds does not reproduce Cloudflare's production lifetime limit.

Open that URL in a browser and use the printed T43 snippet. The automated browser comparisons use the installed Playwright skill CLI wrapper, whose local path is recorded in their scripts:

```sh
python3 experiments/article-stock-2026-09/probe-cache-browser-batch15.py
python3 experiments/article-stock-2026-09/verify-printed-browser-batch15.py
```

These scripts use a real browser's HTTP cache without request interception or disabling cache. Their tabs/sessions are closed in finally blocks. The first also deletes the CacheStorage it creates. Stop the server with Ctrl+C afterward.

The exact printed Worker snippets can be executed separately. This creates and disposes its own local workerd instance:

```sh
node experiments/article-stock-2026-09/workers-batch15/verify-printed.mjs
```

Miniflare 5's exported `convertV4MiniflareOptions` converts the fixture's options. The older direct-constructor option form failed validation before this version was used. `wrangler.jsonc` and the generated Env declaration describe the local test binding; this directory is not configured as a deployed SINK service.
