import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { readFileSync, writeFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import assert from 'node:assert/strict';
const root = new URL('../../../', import.meta.url);
const blocks = (slug, lang) => [...readFileSync(new URL(`public/${slug}.md`, root), 'utf8').matchAll(new RegExp('^```' + lang + '\\n([\\s\\S]*?)^```', 'gm'))].map(m => m[1]);
const [job, observer] = blocks('workers-waituntil-failure-lifetime', 'ts');
const [, cache] = blocks('cloudflare-cache-api-browser-cache', 'js');
let release;
const events = [];
const script = stripTypeScriptTypes(job) + `
export default { async fetch(request, env, ctx) {
  const url = new URL(request.url);
  const key = new Request('https://article.example/synthetic');
  if (url.pathname === '/cache') { ${cache} }
  if (url.pathname === '/read') {
    const stored = await caches.default.match(key);
    return Response.json({ body: await stored.text(), cacheControl: stored.headers.get('Cache-Control') });
  }
  const id = 'printed';
  ${stripTypeScriptTypes(observer)}
  return new Response('accepted', { status: 202 });
} };`;
const options = convertV4MiniflareOptions({ modules: true, script, host: '127.0.0.1', port: 0, compatibilityDate: '2026-09-11', cf: false,
  serviceBindings: { SINK: async request => {
    const path = new URL(request.url).pathname; events.push(path);
    if (path.startsWith('/gate/')) return new Promise(resolve => { release = () => resolve(new Response('fixture failure', { status: 503 })); });
    return new Response('recorded');
  } },
});
options.telemetry = { enabled: false };
const mf = new Miniflare(options);
try {
  const base = String(await mf.ready);
  const response = await fetch(new URL('/wait', base));
  assert.equal(response.status, 202); assert.equal(await response.text(), 'accepted');
  assert(!events.includes('/failed/printed'));
  const until = async predicate => { const start = Date.now(); while (!predicate()) { assert(Date.now() - start < 3000); await new Promise(r => setTimeout(r, 10)); } };
  await until(() => release); release(); await until(() => events.includes('/failed/printed'));
  assert(!events.includes('/done/printed'));
  const client = await fetch(new URL('/cache', base));
  assert.equal(await client.text(), 'synthetic'); assert.equal(client.headers.get('Cache-Control'), 'no-store');
  const stored = await (await fetch(new URL('/read', base))).json();
  assert.deepEqual(stored, { body: 'synthetic', cacheControl: 'public, max-age=60' });
  const report = { printedBlocksExecutedInWorkerd: 3, responseStatus: response.status, failureAfterResponse: true, events, stored, clientCacheControl: 'no-store', remoteResources: false };
  writeFileSync(new URL('production/2026-09/batch-15/printed-worker-experiment.json', root), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
} finally { await mf.dispose(); }
