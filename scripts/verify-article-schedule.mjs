// Current schedule and migration audit. No network calls or publication.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { runPublisher } from './publish-scheduled.mjs';
const yaml = createRequire(import.meta.url)('js-yaml');
const json = p => JSON.parse(readFileSync(p, 'utf8'));
const catalog = json('production/2026-09/catalog.json');
const plan = json('production/2026-09/scheduling/approved-plan.json');
const schedule = json('schedule/publishing-schedule.json');
const policy = json('schedule/publishing-policy.json');
const migration = json('production/2026-09/scheduling/weekly-zenn/migration.json');
const oldCatalog = JSON.parse(execFileSync('git', ['show', `${migration.base_commit}:production/2026-09/catalog.json`], { encoding: 'utf8' }));
const oldSchedule = JSON.parse(execFileSync('git', ['show', `${migration.base_commit}:schedule/publishing-schedule.json`], { encoding: 'utf8' }));
const raw = p => readFileSync(p, 'utf8');
function parse(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/); assert(m);
  let fence = null;
  for (const line of m[2].split('\n')) {
    const f = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (!fence && f) fence = f[1];
    else if (fence && f && f[1][0] === fence[0] && f[1].length >= fence.length && !f[2].trim()) fence = null;
  }
  assert.equal(fence, null, 'unclosed Markdown fence');
  return { meta: yaml.load(m[1]), body: m[2] };
}
assert.equal(catalog.length, 90); assert.equal(plan.entries.length, 90);
assert.deepEqual(schedule, [...oldSchedule.filter(x => x.date < plan.start_date), ...plan.entries]);
for (const key of ['date', 'source', 'devto']) assert.equal(new Set(schedule.map(x => x[key])).size, 128, key);
const future = schedule.filter(x => x.date >= policy.effective_from);
assert.equal(future.length, 68);
for (let n = 0; n < future.length; n++) {
  assert.equal(future[n].date, new Date(Date.parse(policy.effective_from + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10));
  const zenn = future[n].date >= policy.zenn_first_date && new Date(future[n].date).getUTCDay() === 6;
  assert.equal(future[n].platform, zenn ? 'zenn' : 'qiita');
}
const titleSet = new Set(), bodySet = new Set();
const norm = s => s.toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
for (const dir of ['articles', 'public', 'devto']) for (const file of readdirSync(dir).filter(x => x.endsWith('.md'))) {
  const text = raw(`${dir}/${file}`), parts = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!parts) continue;
  const p = { meta: { title: parts[1].match(/^title:\s*(.*)$/m)?.[1]?.replace(/^["']|["']$/g, '') ?? '' }, body: parts[2] };
  const key = `${dir === 'devto' ? 'en' : 'ja'}:${norm(p.meta.title)}`;
  assert(!titleSet.has(key), `duplicate title: ${file}`); titleSet.add(key);
  const bodyKey = `${dir === 'devto' ? 'en' : 'ja'}:${norm(p.body)}`;
  assert(!bodySet.has(bodyKey), `duplicate body: ${file}`); bodySet.add(bodyKey);
}
let bodyMatches = 0, migrationPending = 0;
for (const x of catalog) {
  const before = oldCatalog.find(v => v.id === x.id); assert(before);
  const entry = plan.entries.find(v => v.source === x.japanese);
  assert.deepEqual(entry, { date: x.scheduled_date, platform: x.platform.toLowerCase(), source: x.japanese, devto: x.english });
  for (const lang of ['japanese', 'english']) {
    const a = parse(raw(x[lang]));
    const b = parse(execFileSync('git', ['show', `${migration.base_commit}:${before[lang]}`], { encoding: 'utf8' }));
    assert.equal(a.body, b.body, `${x.id} ${lang}: claims/code/figures/links must not change`);
    assert.equal(a.meta.title, b.meta.title); bodyMatches++;
  }
  const ja = parse(raw(x.japanese)).meta, en = parse(raw(x.english)).meta;
  assert.equal(ja.title, x.title);
  assert.equal(typeof en.published, 'boolean');
  const tags = Array.isArray(en.tags) ? en.tags : en.tags.split(',').map(t => t.trim());
  assert(tags.length >= 1 && tags.length <= 4 && tags.every(t => /^[a-z0-9]+$/.test(t)));
  if (en.published) assert(Number.isInteger(en.devto_id)); else assert(!en.devto_id);
  if (x.platform === 'Zenn') {
    for (const k of ['title', 'emoji', 'type', 'topics', 'published']) assert(k in ja);
    assert.equal(typeof ja.published, 'boolean'); assert(ja.topics.length >= 1 && ja.topics.length <= 5);
    assert.equal(en.canonical_url, `https://zenn.dev/hirodeath/articles/${x.slug}`);
    if (x.scheduled_date >= policy.effective_from && !ja.published) assert.equal(en.published, false);
  } else {
    for (const k of ['title', 'tags', 'private', 'updated_at', 'id', 'organization_url_name', 'slide', 'ignorePublish']) assert(k in ja);
    assert.equal(ja.private, false); assert(ja.tags.length >= 1 && ja.tags.length <= 5);
    if (ja.id) {
      assert.match(ja.id, /^[a-f0-9]{20}$/); assert.equal(ja.ignorePublish, false);
      assert.equal(en.canonical_url, `https://qiita.com/hiro123/items/${ja.id}`);
    } else {
      assert.equal(ja.ignorePublish, true);
      if (x.canonical_migration_pending && en.published) {
        assert(migration.changes.some(v => v.id === x.id && v.english_already_published));
        assert.equal(en.canonical_url, `https://zenn.dev/hirodeath/articles/${x.slug}`); migrationPending++;
      } else { assert.equal(en.published, false); assert.equal(en.canonical_url, null); }
    }
  }
  let selection;
  await runPublisher({ args: [`--date=${x.scheduled_date}`, '--dry-run'], log: v => { selection = JSON.parse(v); }, fetch: () => { throw new Error('network in dry run'); }, write: () => { throw new Error('write in dry run'); } });
  assert.equal(selection.source, x.japanese); assert.equal(selection.devto, x.english);
}
const report = { checked_at: new Date().toISOString(), base_commit: migration.base_commit, pairs: 90, unchangedBodies: bodyMatches,
  historicalEntriesPreserved: 38, futurePairs: future.length, zennSaturdays: future.filter(x => x.platform === 'zenn').length,
  qiitaDays: future.filter(x => x.platform === 'qiita').length, migratedArticles: migration.changes.length, canonicalMigrationPending: migrationPending,
  firstZenn: policy.zenn_first_date, end: plan.end_date, checks: ['90 actual publisher dry runs without writes or API calls', 'frontmatter', 'canonical URLs', 'dev.to tags <= 4', 'Markdown fences', 'duplicate titles and bodies', '180 article bodies and titles unchanged', 'unique dates and article paths', 'weekly Saturday Zenn and daily Japanese schedule'] };
const output = process.argv.find(x => x.startsWith('--output='))?.slice(9);
if (output) writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
