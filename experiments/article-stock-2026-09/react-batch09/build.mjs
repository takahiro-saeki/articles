import { build } from 'esbuild';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const here = dirname(fileURLToPath(import.meta.url));
const out = process.argv[2];
mkdirSync(out, { recursive: true });
const ssr = JSON.parse(execFileSync(process.execPath, [join(here, 'render-ssr.mjs')], { encoding: 'utf8' }));
const html = (script, body = '<div id="root"></div>', before = '') => `<!doctype html><meta charset="utf-8"><title>React article experiments</title><style>body{font:16px sans-serif;padding:24px}label,input{display:block;margin:4px}button{margin:8px}output{display:block}</style>${body}${before}<script src="${script}"></script>`;
for (const environment of ['development', 'production']) {
  await build({ entryPoints: [join(here, 'main.jsx')], outfile: join(out, environment + '.js'), bundle: true,
    platform: 'browser', jsx: 'transform', minify: environment === 'production',
    define: { 'process.env.NODE_ENV': JSON.stringify(environment) } });
  writeFileSync(join(out, environment + '.html'), html(environment + '.js'));
}
await build({ entryPoints: [join(here, 'hydration.jsx')], outfile: join(out, 'hydration.js'), bundle: true,
  platform: 'browser', jsx: 'transform', define: { 'process.env.NODE_ENV': '"development"' } });
for (const mode of ['matching', 'mismatched']) {
  const bootstrap = mode === 'matching' ? ssr.bootstrap : { count: 2 };
  writeFileSync(join(out, mode + '.html'), html('hydration.js', `<div id="root">${ssr.html}</div>`, `<script>window.__BOOTSTRAP__=${JSON.stringify(bootstrap)}</script>`));
}
writeFileSync(join(out, 'favicon.ico'), '');
console.log(JSON.stringify({ node: process.version, platform: process.platform, arch: process.arch,
  packages: Object.fromEntries(['react', 'react-dom', 'esbuild', '@types/react', 'typescript'].map(name =>
    [name, JSON.parse(execFileSync(process.execPath, ['-p', `JSON.stringify(require('${name}/package.json').version)`], { cwd: here, encoding: 'utf8' }))])),
  reactCompiler: false, ssr }));
