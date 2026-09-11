import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const yaml=require('js-yaml');
const catalog=JSON.parse(readFileSync('production/2026-09/catalog.json','utf8'));
const batch=process.argv.find(x=>x.startsWith('--batch='))?.split('=')[1];
const allowPendingCanonical=process.argv.includes('--allow-pending-canonical');
const all=process.argv.includes('--all');
assert(!(all&&batch),'Use --all or --batch, not both');
const selected=catalog.filter(x=>all||(batch?x.batch===Number(batch):['検証済み','完成'].includes(x.status)));
const schedule=JSON.parse(readFileSync('schedule/publishing-schedule.json','utf8'));
const planPath='production/2026-09/scheduling/approved-plan.json';
const plan=existsSync(planPath)?JSON.parse(readFileSync(planPath,'utf8')):null;
if(plan){
 assert.equal(plan.approved_on,'2026-09-12');
 assert.equal(plan.schedule_authorized,true);
 assert.equal(plan.draft_complete_with_null_canonical,true);
 assert.equal(plan.canonical_policy,'resolve-on-publication');
 assert.equal(plan.entries.length,90);
 const historical=JSON.parse(execFileSync('git',['show',`${plan.integration_base_commit}:schedule/publishing-schedule.json`],{encoding:'utf8'}));
 assert.deepEqual(schedule,[...historical,...plan.entries],'approved schedule only; historical entries preserved');
 assert.equal(new Set(schedule.map(x=>x.date)).size,schedule.length,'duplicate schedule date');
 assert.equal(new Set(schedule.map(x=>x.source)).size,schedule.length,'duplicate scheduled source');
 assert.equal(new Set(schedule.map(x=>x.devto)).size,schedule.length,'duplicate scheduled translation');
 assert.equal(plan.entries[0].date,plan.start_date);
 assert.equal(plan.entries.at(-1).date,plan.end_date);
 for(let i=0;i<plan.entries.length;i++){
  assert.equal(plan.entries[i].date,new Date(Date.parse(plan.start_date+'T00:00:00Z')+i*86400000).toISOString().slice(0,10),'consecutive days');
 }
}
assert.equal(catalog.length,90);
assert.equal(new Set(catalog.map(x=>x.id)).size,90);
assert.equal(new Set(catalog.map(x=>x.slug)).size,90);
const ideas=readFileSync('ARTICLE_IDEAS_2026-09.md','utf8');
for(const x of catalog){
 assert(ideas.includes(`| ${x.id} |`),`${x.id}: missing idea`);
 assert(['未着手','調査中','執筆中','検証済み','完成'].includes(x.status));
 assert.equal(x.japanese,`${x.platform==='Zenn'?'articles':'public'}/${x.slug}.md`);
 assert.equal(x.english,`devto/${x.slug}.md`);
 if(plan){
  const reservations=plan.entries.filter(s=>s.source===x.japanese||s.devto===x.english);
  assert.equal(reservations.length,1,`${x.id}: exactly one reservation`);
  assert.deepEqual(reservations[0],{date:x.scheduled_date,platform:x.platform.toLowerCase(),source:x.japanese,devto:x.english});
 }else assert(!schedule.some(s=>s.source===x.japanese||s.devto===x.english),`${x.id}: scheduled without approval`);
}
function parse(path){
 const raw=readFileSync(path,'utf8');
 const m=raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
 assert(m,`${path}: frontmatter`);
 const meta=yaml.load(m[1]),body=m[2];
 assert.equal(typeof meta.title,'string');assert(meta.title.trim());
 let fence=null;const code=[];let lines=[];
 for(const line of body.split('\n')){
  const match=line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
  if(!fence&&match){fence={char:match[1][0],length:match[1].length,lang:match[2].trim()};lines=[];}
  else if(fence&&match&&match[1][0]===fence.char&&match[1].length>=fence.length&&!match[2].trim()){
   code.push({lang:fence.lang,code:lines.join('\n')});fence=null;
  }else if(fence)lines.push(line);
 }
 assert(!fence,`${path}: unclosed fence`);
 assert(!/[—–]/.test(body),`${path}: Humanizer dash audit`);
 // TODO is also the subject of a finished article; reject unfinished markers, not topic words.
 assert(!/(?:^|\n)\s*(?:TODO|TBD)\s*(?=[:：]|\n|$)|example\.com|zenn\.dev\/xxx/.test(raw),`${path}: unresolved placeholder`);
 assert(body.trim().length>0);
 return {path,raw,meta,body,code};
}
const existing=execFileSync('git',['ls-tree','-r','--name-only','8a1bfa8','articles','public','devto'],{encoding:'utf8'}).trim().split('\n').filter(x=>x.endsWith('.md')).map(path=>{
 const raw=execFileSync('git',['show',`8a1bfa8:${path}`],{encoding:'utf8'});
 return {path,title:raw.match(/^title:\s*(.*)$/m)?.[1].replace(/^["']|["']$/g,''),body:raw.replace(/^---\n[\s\S]*?\n---\n/,'')};
});
const normalize=s=>s.toLowerCase().replace(/[\s\p{P}\p{S}]/gu,'');
const grams=s=>{s=normalize(s);return new Set(Array.from({length:Math.max(0,s.length-3)},(_,i)=>s.slice(i,i+4)));};
const similarity=(a,b)=>{let n=0;for(const x of a)if(b.has(x))n++;return n/(a.size+b.size-n||1);};
const newDrafts=catalog.flatMap(x=>[x.japanese,x.english]).filter(existsSync).map(path=>{const p=parse(path);return {path,title:p.meta.title,body:p.body};});
const comparison=[...existing,...newDrafts].map(x=>({...x,grams:grams(x.body)}));
const result=[];const pendingCanonical=[];const deferredCanonical=[];
for(const x of selected){
 const ja=parse(x.japanese),en=parse(x.english);
 assert.equal(ja.meta.title,x.title,`${x.id}: catalog title`);
 for(const article of [ja,en])assert(!comparison.some(e=>e.path!==article.path&&normalize(e.title??'')===normalize(article.meta.title)),`${x.id}: duplicate title in ${article.path}`);
 assert.equal(en.meta.published,false);assert(!en.meta.devto_id,`${x.id}: external draft id`);
 const tags=Array.isArray(en.meta.tags)?en.meta.tags:String(en.meta.tags??'').split(',').map(s=>s.trim()).filter(Boolean);
 assert(tags.length>=1&&tags.length<=4,`${x.id}: devto tags`);
 assert(tags.every(t=>/^[a-z0-9]+$/.test(t)),`${x.id}: invalid devto tag`);
 assert.equal(new Set(tags).size,tags.length);
 if(x.platform==='Zenn'){
  for(const name of ['title','emoji','type','topics','published'])assert(name in ja.meta,`${x.id}: ${name}`);
  assert.equal(ja.meta.published,false);assert(['tech','idea'].includes(ja.meta.type));
  assert(Array.isArray(ja.meta.topics)&&ja.meta.topics.length>=1&&ja.meta.topics.length<=5);
  assert(/^[a-z0-9_-]{12,50}$/.test(x.slug));assert([...ja.meta.title].length<=70);
  assert.equal(en.meta.canonical_url,`https://zenn.dev/hirodeath/articles/${x.slug}`);
 }else{
  for(const name of ['title','tags','private','updated_at','id','organization_url_name','slide','ignorePublish'])assert(name in ja.meta,`${x.id}: ${name}`);
  assert.equal(ja.meta.ignorePublish,true);assert.equal(ja.meta.id,null);assert(Array.isArray(ja.meta.tags)&&ja.meta.tags.length<=5);
  if(plan&&x.canonical_policy===plan.canonical_policy&&x.canonical_status==='公開時に設定'){
   assert.equal(en.meta.canonical_url,null,`${x.id}: canonical must remain null until the publication response`);
   assert.equal(x.canonical_url,null);
   assert.equal(x.status,'完成');
   deferredCanonical.push(x.id);
  }else if(allowPendingCanonical&&x.canonical_status==='URL未確定'&&x.status==='執筆中'){
   assert(en.meta.canonical_url==null,`${x.id}: do not invent a pending canonical URL`);
   pendingCanonical.push(x.id);
  }else{
   assert.equal(en.meta.canonical_url,x.canonical_url,`${x.id}: canonical policy must be resolved in catalog`);
   assert(en.meta.canonical_url,`${x.id}: canonical unresolved`);
  }
 }
 assert(!('published_at' in ja.meta)&&!('published_at' in en.meta),`${x.id}: scheduled metadata`);
 const executable=blocks=>blocks.filter(c=>['sql','ts','tsx','js','jsx','javascript','typescript','python','py','json','bash','sh','gdscript'].includes(c.lang));
 for(const article of [ja,en])for(const block of article.code.filter(c=>c.lang==='json'))JSON.parse(block.code);
 assert.deepEqual(executable(ja.code),executable(en.code),`${x.id}: executable translation mismatch`);
 const jaLinks=[...ja.body.matchAll(/\]\((https?:\/\/[^)]+)\)/g)].map(m=>m[1]).sort();
 const enLinks=[...en.body.matchAll(/\]\((https?:\/\/[^)]+)\)/g)].map(m=>m[1]).sort();
 assert.deepEqual(jaLinks,enLinks,`${x.id}: source links differ`);
 const nearest=article=>{const isEnglish=article.path.startsWith('devto/'),g=grams(article.body);return comparison.filter(e=>e.path!==article.path&&e.path.startsWith('devto/')===isEnglish).map(e=>({path:e.path,score:Number(similarity(g,e.grams).toFixed(3))})).sort((a,b)=>b.score-a.score).slice(0,3);};
 result.push({id:x.id,jaCharacters:ja.body.length,enWords:en.body.trim().split(/\s+/).length,sectionsJA:(ja.body.match(/^## /gm)??[]).length,sectionsEN:(en.body.match(/^## /gm)??[]).length,codeBlocks:ja.code.length,nearestExisting:nearest(ja),nearestEnglish:nearest(en)});
}
console.log(JSON.stringify({pairs:selected.length,canonicalPending:pendingCanonical,canonicalDeferredUntilPublication:deferredCanonical,eligibleForCompletion:selected.length-pendingCanonical.length,scheduledPairs:plan?.entries.length??0,checks:'frontmatter, draft flags, tags, canonical (approved Qiita publication-time resolution), fences, executable snippets including TSX/Python/GDScript and JSON, JSON syntax, links, Japanese and English titles, similarity screening against baseline and new drafts, approved consecutive schedule and preserved history',articles:result},null,2));
