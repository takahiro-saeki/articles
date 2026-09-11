import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { readFileSync, writeFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { performance } from 'node:perf_hooks';
import assert from 'node:assert/strict';
const out = new URL('../../../production/2026-09/batch-15/', import.meta.url);
const events = [], gates = new Map(), counts = new Map(), runtimeErrors = [];
const stamp = (event, id) => { const entry = { event, id, ms: performance.now() }; events.push(entry); return entry; };
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate, limit = 2000) {
  const start = performance.now();
  while (!predicate()) { if (performance.now() - start > limit) throw new Error('Local observation timed out'); await pause(10); }
}
const script = stripTypeScriptTypes(readFileSync(new URL('worker.ts', import.meta.url), 'utf8'));
const options = convertV4MiniflareOptions({
  name: 'article-batch15-lab', modules: true, script, host: '127.0.0.1', port: 9916,
  compatibilityDate: '2026-09-11', compatibilityFlags: ['nodejs_compat'], cf: false,
  serviceBindings: { SINK: async request => {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/gate/')) {
      const id = url.pathname.slice(6); stamp('job-start', id);
      return new Promise(resolve => gates.set(id, status => { stamp('gate-release', id); resolve(new Response('synthetic upstream', { status })); }));
    }
    if (url.pathname.startsWith('/done/')) { stamp('job-done', url.pathname.slice(6)); return new Response('recorded'); }
    if (url.pathname.startsWith('/failed/')) { stamp('job-failed-observed', url.pathname.slice(8)); return new Response('recorded'); }
    if (url.pathname === '/inspect') return Response.json({ events, counts: Object.fromEntries(counts), runtimeErrors }, { headers: { 'Cache-Control': 'no-store' } });
    const key = url.searchParams.get('key');
    const entry = counts.get(key) ?? { visits: 0, sources: 0 };
    if (url.pathname === '/visit') entry.visits++;
    if (url.pathname === '/source') entry.sources++;
    counts.set(key, entry);
    return new Response('generation-' + entry.sources);
  } },
});
options.telemetry = { enabled: false };
options.handleUncaughtError = error => { runtimeErrors.push(error.message); };
const mf = new Miniflare(options);
const base = String(await mf.ready).replace(/\/$/, '');
async function response(mode, id, extra = '') {
  const r = await fetch(`${base}/wait?mode=${mode}&id=${id}${extra}`);
  const body = await r.text(); stamp('response-read', id); return { status: r.status, body };
}
const results = [];
let awaitedRead = false;
const awaited = response('await', 'awaited').then(value => { awaitedRead = true; return value; });
await until(() => gates.has('awaited')); await pause(50); assert.equal(awaitedRead, false);
gates.get('awaited')(200); assert.deepEqual(await awaited, { status: 202, body: 'accepted' });
results.push({ name: 'await', responseBeforeGate: false });
const detached = await response('wait', 'detached'); assert.equal(detached.status, 202);
await until(() => gates.has('detached'));
assert(!events.some(e => e.event === 'job-done' && e.id === 'detached'));
gates.get('detached')(200); await until(() => events.some(e => e.event === 'job-done' && e.id === 'detached'));
results.push({ name: 'waitUntil', responseBeforeCompletion: true });
assert.equal((await response('wait', 'failed', '&other=1')).status, 202);
await until(() => gates.has('failed') && gates.has('failed-other'));
gates.get('failed')(503); await pause(50); gates.get('failed-other')(200);
await until(() => events.some(e => e.event === 'job-done' && e.id === 'failed-other')); await pause(100);
assert(!events.some(e => e.event === 'job-done' && e.id === 'failed'));
assert.equal(events.filter(e => e.event === 'job-start' && e.id === 'failed').length, 1);
results.push({ name: 'failure-and-independent-task', responseStatus: 202, failedStartsAtObservation: 1, independentCompleted: true });
assert.equal((await response('observed', 'caught')).status, 202);
await until(() => gates.has('caught')); gates.get('caught')(503);
await until(() => events.some(e => e.event === 'job-failed-observed' && e.id === 'caught'));
results.push({ name: 'explicit-catch-observer', responseStatus: 202, failureObserved: true, starts: events.filter(e => e.event === 'job-start' && e.id === 'caught').length });
console.log('Short waitUntil comparisons passed; observing a local task beyond 30 seconds.');
await response('wait', 'long-local'); await until(() => gates.has('long-local'));
await pause(35000); gates.get('long-local')(200); await pause(1000);
const longComplete = events.some(e => e.event === 'job-done' && e.id === 'long-local');
results.push({ name: 'local-35-second-gate', gateDelayRequestedMs: 35000, completedAtObservation: longComplete, cloudLimitMeasured: false });
for (const directive of ['no-store', 'private, max-age=60', 'public, max-age=60']) {
  const r = await fetch(base + '/cache-rules?' + new URLSearchParams({ id: directive, directive }));
  results.push({ name: 'cache-rule', directive, result: await r.json() });
}
const versions = Object.fromEntries(['miniflare', 'wrangler', 'workerd'].map(name => [name, JSON.parse(readFileSync(new URL('node_modules/' + name + '/package.json', import.meta.url))).version]));
writeFileSync(new URL('workers-runtime-experiment.json', out), JSON.stringify({ node: process.version, versions, compatibilityDateRequested: '2026-09-11', scope: 'local workerd with a Node service-binding substitute; no remote resource or deployment', results, events, runtimeErrors }, null, 2) + '\n');
console.log('Worker experiments captured. Cache browser endpoint: ' + base);
const finish = async () => { await mf.dispose(); process.exit(0); };
process.on('SIGTERM', finish); process.on('SIGINT', finish);
