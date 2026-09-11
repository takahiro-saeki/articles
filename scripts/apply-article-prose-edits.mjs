// Applies edits chosen during a Humanizer review; this script does not generate prose.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {dirname,join} from 'node:path';
import assert from 'node:assert/strict';
const planPath=process.argv[2];assert(planPath,'Pass the reviewed edit plan JSON');
const plan=JSON.parse(readFileSync(planPath,'utf8'));
const sha=s=>createHash('sha256').update(s).digest('hex');
function frozen(s){
 const match=s.match(/^(---\n[\s\S]*?\n---\n)([\s\S]*)$/);assert(match);
 return {frontmatter:match[1],fences:[...match[2].matchAll(/^```[^\n]*\n[\s\S]*?^```\s*$/gm)].map(m=>m[0]),links:s.match(/https?:\/\/[^\s)]+/g)??[],numbers:s.match(/\d+(?:\.\d+)*/g)??[]};
}
const report=[];
for(const entry of plan.files){
 const before=readFileSync(entry.path,'utf8');let after=before;
 for(const [oldText,newText] of entry.edits){assert.equal(after.split(oldText).length,2,`${entry.path}: expected one exact prose match`);after=after.replace(oldText,newText);}
 assert.deepEqual(frozen(before),frozen(after),`${entry.path}: protected information changed`);
 assert(!/[—–]/.test(after),`${entry.path}: dash review`);
 writeFileSync(entry.path,after);
 report.push({id:entry.id,path:entry.path,before_sha256:sha(before),after_sha256:sha(after),prose_edits:entry.edits.length,frontmatter_code_links_numeric_tokens_unchanged:true,semantic_review:entry.semantic_review});
}
writeFileSync(join(dirname(planPath),'humanizer-audit.json'),JSON.stringify({reviewed_on:plan.reviewed_on,skill:plan.skill,files:report},null,2)+'\n');
console.log(`Applied reviewed prose edits to ${report.length} files; protected fields unchanged.`);
