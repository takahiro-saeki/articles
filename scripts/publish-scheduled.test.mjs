import test from 'node:test';
import assert from 'node:assert/strict';
import { runPublisher, setField } from './publish-scheduled.mjs';

const id = '0123456789abcdef0123';
const canonical = `https://qiita.com/hiro123/items/${id}`;
function fixture(platform = 'qiita', options = {}) {
  const date = platform === 'zenn' ? '2026-10-17' : '2026-10-08';
  const source = `${platform === 'zenn' ? 'articles' : 'public'}/example-article.md`;
  const enPath = 'devto/example-article.md';
  const files = new Map([
    ['schedule/publishing-schedule.json', JSON.stringify([{ date, platform, source, devto: enPath }])],
    ['schedule/publishing-policy.json', JSON.stringify({ effective_from: '2026-10-08', zenn_first_date: '2026-10-17', zenn_weekday: 6, zenn_minimum_interval_hours: 24, zenn_username: 'hirodeath', qiita_username: 'hiro123', devto_username: 'hirodeath' })],
    ['schedule/publication-state.json', JSON.stringify({ articles: {} })],
    [source, platform === 'zenn' ? '---\ntitle: "日本語"\npublished: false\n---\n日本語本文\n' : '---\ntitle: "日本語"\ntags:\n  - JavaScript\nprivate: false\nid: null\nignorePublish: true\n---\n日本語本文\n'],
    [enPath, '---\ntitle: "English"\npublished: false\ntags: [javascript, testing]\ncanonical_url: null\n---\nEnglish body\n'],
  ]);
  const calls = [];
  let remoteEnglish = options.existingEnglish ? { id: 7, title: 'English', body_markdown: 'English body', canonical_url: 'https://zenn.dev/hirodeath/articles/example-article', published_at: '2026-10-02', user: { username: 'hirodeath' }, url: 'https://dev.to/hirodeath/example' } : null;
  if (remoteEnglish) files.set(enPath, setField(setField(files.get(enPath), 'devto_id', 7), 'published', 'true'));
  const response = (value, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => value, text: async () => typeof value === 'string' ? value : JSON.stringify(value) });
  const config = {
    now: new Date(date + 'T03:00:00Z'), args: [`--date=${date}`], env: { QIITA_TOKEN: 'mock', DEVTO_API_KEY: 'mock' },
    read: p => { assert(files.has(p), p); return files.get(p); }, write: (p, v) => files.set(p, v), log: () => {},
    fetch: async (url, opts = {}) => {
      const method = opts.method ?? 'GET'; calls.push({ url, method, payload: opts.body && JSON.parse(opts.body) });
      if (url.startsWith('https://zenn.dev/')) {
        if (options.zennFailure) return response('', options.zennFailure);
        return response(`<script id="__NEXT_DATA__">${JSON.stringify({ props: { pageProps: { isPreview: false, article: { status: 'published', title: options.wrongZennTitle ? 'Wrong' : '日本語', path: '/hirodeath/articles/example-article', publishedAt: '2026-10-17T12:00:00+09:00' } } } })}</script>`);
      }
      if (url === 'https://qiita.com/api/v2/items' && options.qiitaFailure) return response('', 422);
      if (url.startsWith('https://qiita.com/api/v2/items')) return response({ id, url: canonical, private: false, title: '日本語', body: '日本語本文', created_at: '2026-10-08T12:00:00+09:00', updated_at: '2026-10-08T12:00:00+09:00' });
      if (url === canonical) return response('public page');
      if (url.startsWith('https://dev.to/api/articles')) {
        if (method === 'GET') return remoteEnglish ? response(remoteEnglish) : response('', 404);
        if (options.devtoFailure) return response('', 503);
        remoteEnglish = { ...JSON.parse(opts.body).article, id: 7, published_at: '2026-10-08', user: { username: 'hirodeath' }, url: 'https://dev.to/hirodeath/example' };
        return response(remoteEnglish);
      }
      if (url === 'https://dev.to/hirodeath/example') return response('public page');
      throw new Error('Unexpected URL ' + url);
    },
  };
  return { files, calls, config, source, enPath, options, run: extra => runPublisher({ ...config, ...extra }) };
}

test('dry runs do not change metadata or call services, including future dates', async () => {
  const f = fixture('zenn'), before = [...f.files];
  await f.run({ args: [...f.config.args, '--dry-run'], now: new Date('2026-10-08') });
  assert.deepEqual([...f.files], before); assert.equal(f.calls.length, 0);
});
test('Zenn preparation only writes a request; deployment must be pushed separately', async () => {
  const f = fixture('zenn'); await f.run({ args: [...f.config.args, '--prepare'] });
  assert.match(f.files.get(f.source), /published: true/); assert.equal(f.calls.length, 0);
  assert.match(f.files.get(f.enPath), /published: false/);
});
test('a future date and a non-Saturday replay cannot publish early', async () => {
  const f = fixture('zenn');
  await assert.rejects(f.run({ now: new Date('2026-10-08'), args: [...f.config.args, '--prepare'] }), /early/);
  await assert.rejects(f.run({ now: new Date('2026-10-18'), args: [...f.config.args, '--prepare'] }), /Saturdays/);
  assert.equal(f.calls.length, 0);
});
test('published:true with a 403 still fails and never publishes English', async () => {
  const f = fixture('zenn', { zennFailure: 403 }); await f.run({ args: [...f.config.args, '--prepare'] });
  await assert.rejects(f.run(), /HTTP 403/); assert.equal(f.calls.length, 1);
  await f.run({ args: [...f.config.args, '--defer-zenn'] });
  assert.match(f.files.get(f.source), /published: false/);
  assert.equal(JSON.parse(f.files.get('schedule/publication-state.json')).articles['example-article'].status, 'failed');
});
test('a transient check failure cannot unpublish a possibly live Zenn article', async () => {
  const f = fixture('zenn', { zennFailure: 503 }); await f.run({ args: [...f.config.args, '--prepare'] });
  await assert.rejects(f.run({ args: [...f.config.args, '--defer-zenn'] }), /HTTP 503/);
  assert.match(f.files.get(f.source), /published: true/);
});
test('a 200 page with an unexpected title is not treated as published', async () => {
  const f = fixture('zenn', { wrongZennTitle: true }); await f.run({ args: [...f.config.args, '--prepare'] });
  await assert.rejects(f.run(), /could not be verified/); assert.equal(f.calls.length, 1);
});
test('public Zenn verification precedes English publication', async () => {
  const f = fixture('zenn'); await f.run({ args: [...f.config.args, '--prepare'] }); await f.run();
  assert.match(f.calls[0].url, /zenn.dev/); assert.equal(f.calls[1].method, 'POST');
  assert.equal(JSON.parse(f.files.get('schedule/publication-state.json')).articles['example-article'].status, 'verified');
});
test('Qiita migration updates the existing English ID and canonical without reposting', async () => {
  const f = fixture('qiita', { existingEnglish: true }); await f.run();
  assert.equal(f.calls.filter(c => c.method === 'POST').length, 1);
  const update = f.calls.find(c => c.method === 'PUT'); assert.equal(update.url, 'https://dev.to/api/articles/7');
  assert.equal(update.payload.article.canonical_url, canonical); assert.match(f.files.get(f.enPath), /devto_id: 7/);
  f.calls.length = 0; await f.run(); assert(f.calls.every(c => c.method === 'GET'));
});
test('Qiita failure stops English publication', async () => {
  const f = fixture('qiita', { qiitaFailure: true }); await assert.rejects(f.run(), /HTTP 422/);
  assert.equal(f.calls.length, 1); assert.match(f.files.get(f.source), /id: null/);
});
test('English failure preserves the Japanese ID, and retry does not create it again', async () => {
  const f = fixture('qiita', { devtoFailure: true }); await assert.rejects(f.run(), /HTTP 503/);
  assert.match(f.files.get(f.source), new RegExp('id: ' + id));
  f.options.devtoFailure = false; f.calls.length = 0; await f.run();
  assert(!f.calls.some(c => c.url === 'https://qiita.com/api/v2/items' && c.method === 'POST'));
});
test('pending Zenn deployment blocks a second article', async () => {
  const f = fixture('zenn'); f.files.set('schedule/publication-state.json', JSON.stringify({ articles: { older: { platform: 'zenn', status: 'failed' } } }));
  await assert.rejects(f.run({ args: [...f.config.args, '--prepare'] }), /earlier Zenn/);
});
test('one Zenn publication per Saturday and a minimum 24-hour interval are enforced', async () => {
  const f = fixture('zenn'); f.files.set('schedule/publication-state.json', JSON.stringify({ articles: {}, last_zenn_publication: { slug: 'another', published_at: '2026-10-17T09:00:00+09:00' } }));
  await assert.rejects(f.run({ args: [...f.config.args, '--prepare'] }), /interval/);
});
