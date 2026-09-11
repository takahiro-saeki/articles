import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const here = dirname(fileURLToPath(import.meta.url));
const cases = [
  { name: 'implicit-map-return', expected: [2322], source: `import React from 'react';
const nodes = new Map<string, HTMLDivElement | null>();
export const view = <div ref={node => nodes.set('preview', node)} />;` },
  { name: 'cleanup-boolean-return', expected: [2322], source: `import React from 'react';
const nodes = new Map<string, HTMLDivElement>();
export const view = <div ref={node => {
  if (!node) return;
  nodes.set('preview', node);
  return () => nodes.delete('preview');
}} />;` },
  { name: 'cleanup-void-return', expected: [], source: `import React from 'react';
const nodes = new Map<string, HTMLDivElement>();
export const view = <div ref={node => {
  if (!node) return;
  nodes.set('preview', node);
  return () => { nodes.delete('preview'); };
}} />;` },
];
const scratch = mkdtempSync(join(tmpdir(),'article-ref-types-'));
const results = [];
try {
  for (const item of cases) {
    writeFileSync(join(scratch,'main.tsx'),item.source+'\n');
    writeFileSync(join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{strict:true,noEmit:true,target:'ES2022',module:'ESNext',moduleResolution:'Bundler',jsx:'react-jsx',types:['react'],typeRoots:[join(here,'node_modules/@types')],paths:{'react':[join(here,'node_modules/@types/react/index.d.ts')],'react/jsx-runtime':[join(here,'node_modules/@types/react/jsx-runtime.d.ts')]}},files:['main.tsx']}));
    const run = spawnSync(process.execPath,[join(here,'node_modules/typescript/bin/tsc'),'-p',join(scratch,'tsconfig.json'),'--pretty','false'],{encoding:'utf8'});
    const diagnostics=(run.stdout+run.stderr).replaceAll(scratch,'<scratch>').trim();
    const codes=[...diagnostics.matchAll(/TS(\d+):/g)].map(x=>Number(x[1]));
    results.push({...item,exit:run.status,diagnostics,codes});
    assert.deepEqual(codes,item.expected,diagnostics);
    assert.equal(run.status===0,item.expected.length===0);
  }
  writeFileSync(join(here,'../../../production/2026-09/batch-09/ref-type-results.json'),JSON.stringify({node:process.version,typescript:JSON.parse(readFileSync(join(here,'node_modules/typescript/package.json'))).version,reactTypes:JSON.parse(readFileSync(join(here,'node_modules/@types/react/package.json'))).version,cases:results},null,2)+'\n');
  console.log('Ref type cases passed: '+results.length);
} finally { rmSync(scratch,{recursive:true,force:true}); }
