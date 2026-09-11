import { createRequire } from 'node:module';
import { readFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
assert(process.argv[2], 'Pass the package.json path of a scratch installation of wrangler@4.131.0');
const wranglerPackage = realpathSync(resolve(process.argv[2]));
const require = createRequire(wranglerPackage);
const { Miniflare, convertV4MiniflareOptions } = require('miniflare');
const mf = new Miniflare(convertV4MiniflareOptions({
  modules: true,
  script: readFileSync(new URL('./do-partitions/worker.js', import.meta.url), 'utf8'),
  compatibilityDate: '2026-09-11',
  compatibilityFlags: ['nodejs_compat'],
  durableObjects: { ROOMS: { className: 'Room', useSQLite: true } },
  d1Databases: { DB: '00000000-0000-0000-0000-000000000000' },
  durableObjectsPersist: false, d1Persist: false,
}));
try {
  const response = await mf.dispatchFetch('http://local.test/run', { method: 'POST' });
  const result = await response.json();
  assert.equal(response.status, 200, JSON.stringify(result));
  assert.deepEqual(result.red, [{ user_id: 'alice' }]);
  assert.deepEqual(result.blue, [{ user_id: 'bob' }]);
  assert.deepEqual(result.redFromSameName, result.red);
  assert.deepEqual(result.newUniqueObject, []);
  assert.deepEqual(result.d1Global, [{ room_id: 'blue', user_id: 'bob' }, { room_id: 'red', user_id: 'alice' }]);
  assert.deepEqual(result.collectedBoth, result.d1Global);
  assert.deepEqual(result.collectedRedOnly, [{ room_id: 'red', user_id: 'alice' }]);
  console.log(JSON.stringify({
    node: process.version, wrangler: require('./package.json').version,
    miniflare: require('miniflare/package.json').version, compatibilityDateRequested: '2026-09-11',
    scope: 'Local D1 and SQLite-backed Durable Objects. Fixed synthetic data, no deployment, no latency or distributed snapshot measurements.',
    assertionsPassed: 8, result,
  }, null, 2));
} finally { await mf.dispose(); }
