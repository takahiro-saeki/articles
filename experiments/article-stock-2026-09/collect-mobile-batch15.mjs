import { createServer } from 'node:http';
import { appendFileSync } from 'node:fs';
const records = [];
let mode = 'coordinated';
const file = 'production/2026-09/batch-15/mobile-events.ndjson';
const server = createServer(async (request, response) => {
  if (request.url === '/mode') {
    if (request.method === 'POST') {
      let body = ''; for await (const chunk of request) body += chunk;
      const input = JSON.parse(body);
      if (!['early', 'coordinated'].includes(input.mode)) { response.writeHead(400).end(); return; }
      mode = input.mode;
    }
    response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify({ mode })); return;
  }
  if (request.url === '/event' && request.method === 'POST') {
    let body = '';
    for await (const chunk of request) { body += chunk; if (body.length > 10000) { response.writeHead(413).end(); return; } }
    const record = JSON.parse(body);
    records.push(record); appendFileSync(file, JSON.stringify(record) + '\n');
    response.writeHead(204).end(); return;
  }
  if (request.url === '/auth') {
    setTimeout(() => response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end('{"ready":true}'), 4000);
    return;
  }
  response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify(records));
});
server.listen(9915, '127.0.0.1', () => console.log('Article native probe collector: 127.0.0.1:9915'));
process.on('SIGTERM', () => server.close());
process.on('SIGINT', () => server.close());
