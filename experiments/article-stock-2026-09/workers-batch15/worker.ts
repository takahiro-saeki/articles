async function backgroundJob(env: Env, id: string) {
  const response = await env.SINK.fetch(`http://sink/gate/${id}`);
  if (!response.ok) throw new Error(`Background job failed: ${id}`);
  await response.text();
  await env.SINK.fetch(`http://sink/done/${id}`);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/wait') {
      const id = url.searchParams.get('id') ?? 'local';
      if (url.searchParams.get('mode') === 'await') {
        await backgroundJob(env, id);
      } else if (url.searchParams.get('mode') === 'observed') {
        ctx.waitUntil(backgroundJob(env, id).catch(async error => {
          console.error(JSON.stringify({ event: 'background-failed', id, message: error.message }));
          await env.SINK.fetch(`http://sink/failed/${id}`);
        }));
      } else {
        ctx.waitUntil(backgroundJob(env, id));
        if (url.searchParams.has('other')) ctx.waitUntil(backgroundJob(env, id + '-other'));
      }
      return new Response('accepted', { status: 202 });
    }
    if (url.pathname === '/data') {
      const mode = url.searchParams.get('mode');
      const key = new Request(request.url);
      await env.SINK.fetch('http://sink/visit?key=' + encodeURIComponent(request.url));
      const storeInWorker = mode === 'worker' || mode === 'both';
      let response = storeInWorker ? await caches.default.match(key) : undefined;
      if (!response) {
        const source = await env.SINK.fetch('http://sink/source?key=' + encodeURIComponent(request.url));
        response = new Response(source.body, { headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'public, max-age=60' } });
        if (storeInWorker) await caches.default.put(key, response.clone());
      }
      const client = new Response(response.body, response);
      client.headers.set('Cache-Control', mode === 'browser' || mode === 'both' ? 'private, max-age=60' : 'no-store');
      return client;
    }
    if (url.pathname === '/purge') {
      const target = url.searchParams.get('target');
      if (!target || new URL(target).origin !== url.origin) return new Response('Invalid target', { status: 400 });
      return Response.json({ deleted: await caches.default.delete(target) }, { headers: { 'Cache-Control': 'no-store' } });
    }
    if (url.pathname === '/cache-rules') {
      const id = url.searchParams.get('id') ?? 'rule';
      const directive = url.searchParams.get('directive') ?? 'no-store';
      const key = new Request(url.origin + '/rule/' + id);
      const result = await caches.default.put(key, new Response('synthetic', { headers: { 'Cache-Control': directive } }));
      return Response.json({ putReturnedUndefined: result === undefined, found: Boolean(await caches.default.match(key)) });
    }
    if (url.pathname === '/inspect') return env.SINK.fetch('http://sink/inspect');
    return new Response('<!doctype html><html><head><title>Article cache lab</title></head><body><h1>Local cache experiment</h1></body></html>', {
      headers: { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' },
    });
  },
} satisfies ExportedHandler<Env>;
