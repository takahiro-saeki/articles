import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const read=slug=>readFileSync(`articles/${slug}.md`,'utf8');
const fence=(raw,lang)=>raw.match(new RegExp('```'+lang+'\\n([\\s\\S]*?)\\n```'))[1];
const lines=[];
vm.runInNewContext(fence(read('devlog-primary-source-reconstruction'),'js'),{console:{log:(...args)=>lines.push(args)}},{timeout:1000});
assert.equal(JSON.stringify(lines),'[[720,1440]]');
const excerpt=JSON.parse(fence(read('generated-asset-provenance-decisions'),'json'));
const base='events/2026-ai-browser-game-jam-4/';
const manifest=JSON.parse(execFileSync('git',['show',`f074703848586828b6a5acc0e465ccdd2c0d5244:${base}tools/art-review/data/review-manifest.json`],{cwd:process.argv[2]??'../game-jam-lab',encoding:'utf8'}));
const original=manifest.batches.flatMap(b=>b.candidates).find(c=>c.id===excerpt.id);assert(original);
function subset(actual,expected){for(const [key,value] of Object.entries(expected)){if(value!==null&&typeof value==='object')subset(actual[key],value);else assert.equal(actual[key],value,`manifest field ${key}`);}}
subset(original,excerpt);
const python=fence(read('local-image-generation-reproducibility'),'python');
execFileSync('python3',['-c','import sys; compile(sys.stdin.read(), "article-excerpt", "exec")'],{input:python});
console.log(JSON.stringify({node:process.version,devlog_example:{actual:lines[0],passed:true},manifest_excerpt:{matches_fixed_source:true},python_excerpt:{syntax_valid:true,standalone_execution:false,behavior_covered_by:'local-image-records.py'}},null,2));
