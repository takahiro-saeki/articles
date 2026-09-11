import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const normalized=text=>text.replace(/\s+/g,'').replace(/;$/,'');
const nodeEvidence=JSON.parse(readFileSync('production/2026-09/batch-04/node-module-boundaries.json','utf8'));
const paging=JSON.parse(readFileSync('production/2026-09/batch-04/d1-pagination.json','utf8'));
const retry=JSON.parse(readFileSync('production/2026-09/batch-04/d1-idempotency-outbox.json','utf8'));
const partitions=JSON.parse(readFileSync('production/2026-09/batch-04/do-partitions.json','utf8'));
assert.equal(nodeEvidence.results.length,10);assert.equal(paging.results.length,5);
assert.equal(retry.idempotency.length,6);assert.equal(retry.outbox.length,4);
assert.equal(partitions.assertionsPassed,8);
assert.deepEqual(partitions.result.collectedBoth,partitions.result.d1Global);
const pairs=[
 ['node-esm-commonjs-boundaries',Object.values(nodeEvidence.files).map(normalized)],
 ['d1-offset-cursor-pagination',[normalized(readFileSync('experiments/article-stock-2026-09/d1-pagination.mjs','utf8').replace(/\\n/g,'\n'))]],
 ['idempotency-key-result-storage',[normalized(readFileSync('experiments/article-stock-2026-09/d1-idempotency-outbox.mjs','utf8'))]],
 ['outbox-database-notification-boundary',[normalized(readFileSync('experiments/article-stock-2026-09/d1-idempotency-outbox.mjs','utf8'))]],
 ['durable-objects-d1-coordination',[normalized(readFileSync('experiments/article-stock-2026-09/do-partitions/worker.js','utf8'))]],
];
const report=[];
for(const [slug,sources] of pairs){
 const raw=readFileSync(`articles/${slug}.md`,'utf8');
 const blocks=[...raw.matchAll(/^```(js|sql)\n([\s\S]*?)^```/gm)];
 for(const [,lang,code] of blocks)assert(sources.some(source=>source.includes(normalized(code))),`${slug}: ${lang} excerpt differs from executed code`);
 report.push({slug,excerptsMatchedToExecutedSource:blocks.length});
}
for(const dir of ['articles','devto']){
 const raw=normalized(readFileSync(`${dir}/d1-offset-cursor-pagination.md`,'utf8'));
 for(const x of paging.results){
  assert(raw.includes(`|${x.offset}|${x.last_meta.offset.rows_read}|${x.last_meta.cursor.rows_read}|`));
  assert(raw.includes(`|${x.offset}|${x.wall_ms.offset.median.toFixed(3)}|${x.wall_ms.cursor.median.toFixed(3)}|`));
 }
}
console.log(JSON.stringify({articles:report,pagingTablesMatchRawEvidenceInBothLanguages:true,scope:'Whitespace-normalized article excerpts match source run by the experiments; performance table values match stored observations, not recomputed benchmarks.'},null,2));
