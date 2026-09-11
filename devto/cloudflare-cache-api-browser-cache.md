---
title: "Deleting a Worker's cache did not change the response: separate browser storage from Worker storage"
published: false
tags: cloudflare, http, caching, javascript
canonical_url: null
---

Deleting a response through the Workers Cache API does not clear a browser's HTTP cache. Looking only at the response body can make a successful deletion look ineffective. Count requests reaching the Worker separately from reads of the original data.

This comparison used local workerd and a real browser across 4 storage conditions. With caching enabled in both places, the browser kept using the same response after the Worker-side delete returned true.

## Count each stage separately

The verification date was September 11, 2026. The environment was macOS 26.6.2, Node.js 24.15.0, Wrangler 4.131.0, Miniflare 5.20260910.0-alpha, workerd 1.20260910.1, and HeadlessChrome 152. The Worker's compatibility_date was 2026-09-11.

The comparison Worker recorded incoming requests and reads from a substitute Service Binding. Each data read changed the body from generation-1 to generation-2 and so on. This was newly written reproduction code, not a modification to a real service's cache settings.

Install the dependencies for the [comparison Worker and harness](https://github.com/takahiro-saeki/articles/tree/codex/article-stock-2026-09/experiments/article-stock-2026-09/workers-batch15), then run `node experiments/article-stock-2026-09/workers-batch15/run.mjs` from the repository root. It serves HTTP at 127.0.0.1:9916. Open that page in a browser and run the following code to inspect response bodies and request counts with both stores enabled. Stop the server with Ctrl+C after the experiment.

```js
const url = '/data?mode=both&run=' + crypto.randomUUID();
const first = await (await fetch(url)).text();
const second = await (await fetch(url)).text();
const { counts } = await (await fetch('/inspect', { cache: 'no-store' })).json();
console.log({ first, second, counts: counts[new URL(url, location.href).href] });
```

These are the results of 2 ordinary browser fetch calls to the same URL. Each condition used a different URL to avoid carrying over earlier results.

| Storage enabled | Requests reaching the Worker | Original data reads | Bodies from the 2 fetch calls |
| --- | ---: | ---: | --- |
| Neither place | 2 | 2 | generation-1, generation-2 |
| Workers Cache API only | 2 | 1 | Both generation-1 |
| Browser HTTP cache only | 1 | 1 | Both generation-1 |
| Both | 1 | 1 | Both generation-1 |

Identical bodies can mean that the Worker read a stored response or that the request never reached the Worker. Body equality alone cannot distinguish them.

## The response stored by Workers and the response sent to the browser

The Worker-only condition passed public, max-age=60 to the Cache API, then sent no-store to the browser. This code sets separate headers for storage and for the outgoing response.

```js
const stored = new Response('synthetic', {
  headers: { 'Cache-Control': 'public, max-age=60' },
});
await caches.default.put(key, stored.clone());
const client = new Response(stored.body, stored);
client.headers.set('Cache-Control', 'no-store');
return client;
```

key is a GET Request for the target URL. This excerpt covers storage and outgoing headers; the table's experiment also performed cache.match before this stage. Cloning the stored Response separates consumption of its body from the outgoing response.

The browser-only condition did not write to the Cache API and returned private, max-age=60. The [RFC 9111 storage conditions](https://httpwg.org/specs/rfc9111.html#storing.responses) restrict shared-cache storage with private and prohibit storage with no-store. These bodies were shareable synthetic values, not examples of placing user-specific or authenticated responses into shared storage.

The [Workers Cache API specification](https://developers.cloudflare.com/workers/runtime-apis/cache/) also handles Cache-Control on the Response passed to put. Check which Response actually received the header.

## A true result from delete does not mean the next fetch reaches the Worker

The condition with storage in both places followed this sequence.

1. Perform 2 ordinary fetch calls. The Worker receives 1 request and reads the original data once.
2. Delete the same key through the Workers Cache API. delete returns true.
3. Perform another ordinary browser fetch. The body remains generation-1 and the Worker request count remains 1.
4. Fetch with cache: 'reload'. The request reaches the Worker and retrieves generation-2.

The reload option in this test provided a network result rather than directly reusing the browser's stored response. Repeating ordinary fetch calls after deleting the Worker's entry can continue showing the same body without reaching the Worker.

With Worker-only storage, an ordinary fetch after deletion reached the Worker and increased original data reads to 2. With browser-only storage, the Worker-side delete returned false, while the browser continued using its stored body.

## A resolved put Promise does not prove that an entry was stored

Another comparison varied the Response header passed to the Cache API across 3 conditions.

| Cache-Control | Value returned by put | Immediate match |
| --- | --- | --- |
| no-store | undefined | Missing |
| private, max-age=60 | undefined | Missing |
| public, max-age=60 | undefined | Found |

In this local environment, the put Promise resolved in all cases. The [official specification](https://developers.cloudflare.com/workers/runtime-apis/cache/) likewise does not define its resolved value as proof of successful storage. Check the same key with match and inspect the returned content.

These were immediate reads. The comparison did not measure eviction, retrieval after expiration, or hit rates across multiple locations.

## Browser CacheStorage is also separate from the HTTP cache

Browsers provide CacheStorage, which JavaScript can access through caches.open. The test page registered no Service Worker and explicitly put a synthetic Response with no-store into CacheStorage.

cache.match could read that Response, while a network fetch to the same URL returned different content. A Response stored by JavaScript does not automatically serve an HTTP request. The CacheStorage created for the test was deleted afterward.

The Workers Cache API, browser HTTP cache, and browser CacheStorage each have their own storage and read path. Browser storage in the 4-condition table refers to the HTTP cache.

On Cloudflare, the documented Cache API does not automatically replicate entries across locations, and delete acts at the location handling the invocation. This comparison used 1 local runtime, so it did not test Cloudflare locations or Tiered Cache. Counting requests first helps distinguish a successful deletion from a browser response that never consulted that store.
