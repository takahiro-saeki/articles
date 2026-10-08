import { readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function splitMarkdown(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) throw new Error('frontmatter not found');
  return { frontmatter: m[1], body: m[2].trim() };
}
export function field(fm, name) {
  const v = fm.match(new RegExp(`^${name}:[ \\t]*(.*)$`, 'm'))?.[1]?.trim();
  if (v?.startsWith('"')) return JSON.parse(v);
  if (v?.startsWith("'") && v.endsWith("'")) return v.slice(1, -1).replace(/''/g, "'");
  return v;
}
export function setField(raw, name, value) {
  const p = new RegExp(`^${name}:.*$`, 'm');
  return p.test(raw) ? raw.replace(p, () => `${name}: ${value}`) : raw.replace(/^---\n/, () => `---\n${name}: ${value}\n`);
}
const jst = now => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
const weekday = date => new Date(`${date}T00:00:00Z`).getUTCDay();

export async function runPublisher({ args = [], now = new Date(), env = process.env,
  read = p => readFileSync(p, 'utf8'), write = writeFileSync, fetch = globalThis.fetch, log = console.log } = {}) {
  const today = jst(now), date = args.find(a => a.startsWith('--date='))?.slice(7) ?? today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) throw new Error('Invalid date');
  const entry = JSON.parse(read('schedule/publishing-schedule.json')).find(x => x.date === date);
  if (!entry) { log(`${date}: scheduled article not found`); return; }
  const policy = JSON.parse(read('schedule/publishing-policy.json'));
  const statePath = 'schedule/publication-state.json', state = JSON.parse(read(statePath));
  const slug = basename(entry.source, '.md');
  let source = read(entry.source), englishRaw = read(entry.devto);
  const ja = splitMarkdown(source), en = splitMarkdown(englishRaw), title = field(ja.frontmatter, 'title');
  const sourceIsPublished = entry.platform === 'zenn' ? field(ja.frontmatter, 'published') === 'true'
    : field(ja.frontmatter, 'ignorePublish') === 'false' && /^[a-f0-9]{20}$/.test(field(ja.frontmatter, 'id') ?? '');
  const englishId = field(en.frontmatter, 'devto_id');
  if (args.includes('--dry-run')) {
    log(JSON.stringify({ today: date, ...entry, sourceSlug: slug, sourceIsPublished, devtoIsPublished: field(en.frontmatter, 'published') === 'true' && Boolean(englishId) })); return;
  }
  if (date > today) throw new Error('Refusing early publication');
  if (!['zenn', 'qiita'].includes(entry.platform)) throw new Error('Unsupported platform');
  const saveState = () => write(statePath, JSON.stringify(state, null, 2) + '\n');
  const saveSource = raw => { source = raw; write(entry.source, raw); };
  const saveEnglish = raw => { englishRaw = raw; write(entry.devto, raw); };
  async function request(url, options = {}) {
    const r = await fetch(url, { ...options, signal: AbortSignal.timeout(30000) });
    if (!r.ok) throw new Error(`${new URL(url).hostname} HTTP ${r.status}: ${url}`);
    return r;
  }
  async function verifyZenn(url) {
    const html = await (await request(url)).text();
    const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    const p = m ? JSON.parse(m[1]).props?.pageProps : null, a = p?.article;
    if (!a || p.isPreview || a.status !== 'published' || a.title !== title || a.path !== new URL(url).pathname || !a.publishedAt)
      throw new Error(`Zenn public article could not be verified: ${url}`);
    return a;
  }
  function checkZennWindow() {
    if (date < policy.zenn_first_date || weekday(date) !== policy.zenn_weekday || weekday(today) !== policy.zenn_weekday)
      throw new Error('Zenn publication is restricted to Saturdays from ' + policy.zenn_first_date);
    const prev = state.last_zenn_publication;
    if (prev && prev.slug !== slug && (jst(new Date(prev.published_at)) === today || now - new Date(prev.published_at) < policy.zenn_minimum_interval_hours * 3600000))
      throw new Error('Zenn publication interval has not elapsed');
    const pending = Object.entries(state.articles).find(([key, v]) => key !== slug && v.platform === 'zenn' && ['awaiting_deployment', 'failed'].includes(v.status));
    if (pending) throw new Error(`Resolve the earlier Zenn publication first: ${pending[0]}`);
  }
  const zennUrl = `https://zenn.dev/${policy.zenn_username}/articles/${slug}`;
  if (args.includes('--defer-zenn')) {
    if (entry.platform === 'zenn' && state.articles[slug]?.status === 'awaiting_deployment') {
      // Do not unpublish a deployment that completed just after verification failed.
      try {
        const a = await verifyZenn(zennUrl);
        state.last_zenn_publication = { slug, published_at: a.publishedAt };
        state.articles[slug] = { platform: 'zenn', status: 'source_verified', canonical_url: zennUrl, published_at: a.publishedAt };
      } catch (error) {
        if (!/HTTP (403|404):/.test(error.message)) throw error;
        saveSource(setField(source, 'published', 'false'));
        state.articles[slug].status = 'failed';
      }
      saveState();
    }
    return;
  }
  if (args.includes('--prepare')) {
    if (entry.platform === 'zenn' && !sourceIsPublished) {
      checkZennWindow();
      saveSource(setField(source, 'published', 'true'));
      state.articles[slug] = { platform: 'zenn', status: 'awaiting_deployment', requested_at: now.toISOString() }; saveState();
    }
    log(`${date}: preparation complete; public availability not yet verified`); return;
  }

  let canonicalUrl, publishedAt;
  if (entry.platform === 'zenn') {
    if (!sourceIsPublished) throw new Error('Run --prepare and push before Zenn verification');
    const a = await verifyZenn(zennUrl); canonicalUrl = zennUrl; publishedAt = a.publishedAt;
    if (!state.last_zenn_publication || new Date(publishedAt) > new Date(state.last_zenn_publication.published_at))
      state.last_zenn_publication = { slug, published_at: publishedAt };
  } else {
    let id = field(ja.frontmatter, 'id');
    if (!/^[a-f0-9]{20}$/.test(id ?? '')) {
      if (!env.QIITA_TOKEN || !env.DEVTO_API_KEY) throw new Error('QIITA_TOKEN and DEVTO_API_KEY are required before creating an article');
      const tags = [...ja.frontmatter.matchAll(/^\s+-\s+(.+)$/gm)].map(m => ({ name: m[1].trim() }));
      if (tags.length < 1 || tags.length > 5 || field(ja.frontmatter, 'private') !== 'false') throw new Error('Invalid Qiita metadata');
      const item = await (await request('https://qiita.com/api/v2/items', {
        method: 'POST', headers: { Authorization: `Bearer ${env.QIITA_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body: ja.body, private: false, tags }),
      })).json();
      if (!/^[a-f0-9]{20}$/.test(item.id ?? '')) throw new Error('Invalid Qiita response ID');
      id = item.id;
      // Save the ID before English publication or public verification can fail.
      saveSource(setField(setField(setField(source, 'id', id), 'ignorePublish', 'false'), 'updated_at', JSON.stringify(item.updated_at)));
    }
    const item = await (await request(`https://qiita.com/api/v2/items/${id}`)).json();
    canonicalUrl = `https://qiita.com/${policy.qiita_username}/items/${id}`;
    if (item.private !== false || item.url !== canonicalUrl || item.title !== title || item.body?.trim() !== ja.body)
      throw new Error('Public Qiita content differs from the scheduled article');
    await request(canonicalUrl); publishedAt = item.created_at;
  }
  state.articles[slug] = { platform: entry.platform, status: 'source_verified', canonical_url: canonicalUrl, published_at: publishedAt }; saveState();
  const expectedTitle = field(en.frontmatter, 'title');
  const matches = a => a.title === expectedTitle && a.body_markdown?.trim() === en.body && a.canonical_url === canonicalUrl
    && Boolean(a.published_at) && a.user?.username === policy.devto_username;
  let english;
  if (englishId) {
    const r = await fetch(`https://dev.to/api/articles/${englishId}`, { signal: AbortSignal.timeout(30000) });
    if (r.ok) english = await r.json(); else if (r.status !== 404) throw new Error(`dev.to HTTP ${r.status}`);
  }
  if (!english || !matches(english)) {
    if (!env.DEVTO_API_KEY) throw new Error('DEVTO_API_KEY is not set');
    const tags = (field(en.frontmatter, 'tags') ?? '').replace(/^\[|\]$/g, '').split(',').map(t => t.trim().replace(/^["']|["']$/g, '').toLowerCase()).filter(Boolean);
    if (tags.length < 1 || tags.length > 4 || tags.some(t => !/^[a-z0-9]+$/.test(t))) throw new Error('Invalid dev.to tags');
    const item = await (await request(englishId ? `https://dev.to/api/articles/${englishId}` : 'https://dev.to/api/articles', {
      method: englishId ? 'PUT' : 'POST', headers: { 'api-key': env.DEVTO_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ article: { title: expectedTitle, body_markdown: en.body, published: true, canonical_url: canonicalUrl, tags } }),
    })).json();
    if (!Number.isInteger(item.id)) throw new Error('Invalid dev.to response ID');
    saveEnglish(setField(setField(setField(englishRaw, 'devto_id', item.id), 'published', 'true'), 'canonical_url', canonicalUrl));
    english = await (await request(`https://dev.to/api/articles/${item.id}`)).json();
  }
  if (!matches(english)) throw new Error('Public dev.to content or canonical could not be verified');
  if (!english.url?.startsWith(`https://dev.to/${policy.devto_username}/`)) throw new Error('Unexpected dev.to URL');
  await request(english.url);
  saveEnglish(setField(setField(setField(englishRaw, 'devto_id', english.id), 'published', 'true'), 'canonical_url', canonicalUrl));
  state.articles[slug] = { ...state.articles[slug], status: 'verified', devto_id: english.id, devto_url: english.url, verified_at: now.toISOString() }; saveState();
  log(JSON.stringify({ date, platform: entry.platform, canonicalUrl, devtoUrl: english.url, status: 'verified' }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  runPublisher({ args: process.argv.slice(2) }).catch(e => { console.error(e.message); process.exitCode = 1; });
}
