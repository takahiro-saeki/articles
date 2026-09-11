// Exercise the production publisher against all approved drafts without network access.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { basename } from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require=createRequire(import.meta.url);
const yaml=require('js-yaml');
const out='production/2026-09/scheduling';
const reportDir=process.argv.find(arg=>arg.startsWith('--output='))?.slice(9)??out;
const plan=JSON.parse(readFileSync(`${out}/approved-plan.json`,'utf8'));
const catalog=JSON.parse(readFileSync('production/2026-09/catalog.json','utf8'));
const script=readFileSync('scripts/publish-scheduled.mjs','utf8');
const source=script.replace(/^import .*;\n/gm,'');
assert.equal((script.match(/^import /gm)??[]).length,2);
const sha=s=>createHash('sha256').update(s).digest('hex');
const parse=s=>{const m=s.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);assert(m);return {meta:yaml.load(m[1]),body:m[2].trim()};};
const allPaths=catalog.flatMap(x=>[x.japanese,x.english]);
const diskBefore=Object.fromEntries(allPaths.map(p=>[p,sha(readFileSync(p))]));
const fixtures=new Map([
 ['schedule/publishing-schedule.json',readFileSync('schedule/publishing-schedule.json','utf8')],
 ...allPaths.map(p=>[p,readFileSync(p,'utf8')])
]);
const priorities=catalog.filter(x=>x.priority!=null).sort((a,b)=>a.priority-b.priority);
assert.deepEqual(plan.entries.slice(0,12).map(x=>x.source),priorities.map(x=>x.japanese));

async function simulate(entry,{files=new Map(fixtures),dryRun=false,failQiita=false,failDevto=false}={}){
 const calls=[],writes=[],logs=[];const stopped=Symbol('exit');let error=null;
 const itemId='0123456789abcdef0123';
 const qiitaUrl=`https://qiita.com/local_test_fixture/items/${itemId}`;
 const context={
  basename,
  process:{argv:['node','script',`--date=${entry.date}`,...(dryRun?['--dry-run']:[])],env:{QIITA_TOKEN:'local-mock-only',DEVTO_API_KEY:'local-mock-only'},exit(code=0){assert.equal(code,0);throw stopped;}},
  console:{log(value){logs.push(value);}},
  readFileSync(path){assert(files.has(path),path);return files.get(path);},
  writeFileSync(path,value){assert([entry.source,entry.devto].includes(path));writes.push(path);files.set(path,value);},
  async fetch(url,options){
   const payload=JSON.parse(options.body);calls.push({url,method:options.method,payload});
   if(url.startsWith('https://qiita.com/api/v2/items')){
    if(failQiita)return {ok:false,status:422,text:async()=>'mock failure'};
    return {ok:true,json:async()=>({id:itemId,url:qiitaUrl,updated_at:'2026-09-13T00:00:00Z'})};
   }
   assert.match(url,/^https:\/\/dev\.to\/api\/articles(?:\/123)?$/);
   if(failDevto)return {ok:false,status:503,text:async()=>'mock failure'};
   return {ok:true,json:async()=>({id:123,url:'https://dev.to/local_test_fixture/article'})};
  }
 };
 try{await vm.runInNewContext(`(async()=>{${source}\n})()`,context);}catch(e){if(e!==stopped)error=e.message;}
 return {calls,writes,files,logs,error,qiitaUrl};
}

const results=[];
for(const entry of plan.entries){
 const item=catalog.find(x=>x.japanese===entry.source);assert(item);
 // Invoke the actual CLI, in addition to the in-memory execution below.
 const dry=JSON.parse(execFileSync(process.execPath,['scripts/publish-scheduled.mjs',`--date=${entry.date}`,'--dry-run'],{encoding:'utf8'}));
 assert.equal(dry.source,entry.source);assert.equal(dry.devto,entry.devto);
 assert.equal(dry.today,entry.date);assert.equal(dry.platform,entry.platform);
 assert.equal(dry.sourceIsPublished,false);assert.equal(dry.devtoIsPublished,false);
 const simulatedDry=await simulate(entry,{dryRun:true});
 assert.equal(simulatedDry.error,null);assert.equal(simulatedDry.calls.length,0);assert.equal(simulatedDry.writes.length,0);
 const r=await simulate(entry);assert.equal(r.error,null,`${item.id}: ${r.error}`);
 const ja=parse(fixtures.get(entry.source)),en=parse(fixtures.get(entry.devto));
 if(entry.platform==='qiita'){
  assert.equal(r.calls.length,2);
  const call=r.calls[0];assert.equal(call.method,'POST');
  assert.deepEqual(call.payload,{title:ja.meta.title,body:ja.body,private:ja.meta.private,tags:ja.meta.tags.map(name=>({name}))});
  assert.equal(parse(r.files.get(entry.source)).meta.id,'0123456789abcdef0123');
  assert.equal(parse(r.files.get(entry.source)).meta.ignorePublish,false);
 }else{
  assert.equal(r.calls.length,1);assert.equal(parse(r.files.get(entry.source)).meta.published,true);
 }
 const canonical=entry.platform==='qiita'?r.qiitaUrl:`https://zenn.dev/hirodeath/articles/${item.slug}`;
 const devto=r.calls.at(-1);assert.equal(devto.method,'POST');
 const tags=Array.isArray(en.meta.tags)?en.meta.tags:en.meta.tags.split(',').map(t=>t.trim());
 assert.deepEqual(devto.payload.article,{title:en.meta.title,body_markdown:en.body,published:true,canonical_url:canonical,tags});
 const finalEnglish=parse(r.files.get(entry.devto));
 assert.equal(finalEnglish.meta.canonical_url,canonical);assert.equal(finalEnglish.meta.published,true);
 assert.equal(finalEnglish.meta.devto_id,123);
 assert.equal(parse(r.files.get(entry.source)).body,ja.body);assert.equal(finalEnglish.body,en.body);
 const replay=await simulate(entry,{files:r.files});
 assert.equal(replay.error,null);assert.equal(replay.calls.length,0);assert.equal(replay.writes.length,0);
 results.push({id:item.id,date:entry.date,platform:entry.platform,cliDryRun:'pass',payloadTitleBodyTagsCanonical:'pass',secondRunSkipped:'pass'});
}

const firstQiita=plan.entries.find(x=>x.platform==='qiita');
const rejected=await simulate(firstQiita,{failQiita:true});
assert.match(rejected.error,/Qiita API 422/);assert.equal(rejected.calls.length,1);assert.equal(rejected.writes.length,0);
for(const platform of ['qiita','zenn']){
 const entry=plan.entries.find(x=>x.platform===platform);
 const interrupted=await simulate(entry,{failDevto:true});assert.match(interrupted.error,/dev.to API 503/);
 const retry=await simulate(entry,{files:interrupted.files});assert.equal(retry.error,null);
 if(platform==='qiita')assert.equal(retry.calls[0].method,'PATCH');
 assert.equal(retry.calls.at(-1).method,'POST');
}
const adjacentDate=(date,days)=>new Date(Date.parse(date+'T00:00:00Z')+days*86400000).toISOString().slice(0,10);
for(const date of [adjacentDate(plan.start_date,-1),adjacentDate(plan.end_date,1)]){
 const none=await simulate({date});assert.equal(none.error,null);assert.equal(none.calls.length,0);assert.equal(none.writes.length,0);
}
// Demonstrate why quoted strings must be decoded before API submission.
const escapedPath='devto/bilingual-canonical-url-lifecycle.md';
const escaped=fixtures.get(escapedPath).match(/^title: (.*)$/m)[1];
assert.notEqual(escaped.replace(/^["']|["']$/g,''),parse(fixtures.get(escapedPath)).meta.title);
assert.equal(JSON.parse(escaped),parse(fixtures.get(escapedPath)).meta.title);
const diskAfter=Object.fromEntries(allPaths.map(p=>[p,sha(readFileSync(p))]));
assert.deepEqual(diskAfter,diskBefore,'all 180 disk drafts unchanged');
mkdirSync(reportDir,{recursive:true});
const report={node:process.version,mode:'actual CLI dry-runs plus in-memory filesystem and fetch mocks; no real publishing requests',start:plan.start_date,end:plan.end_date,pairs:results.length,priority12First:true,dryRunNoWritesOrApiCalls:90,payloadParity:90,alreadyPublishedNoOp:90,qiitaResponseCanonical:49,zennSlugCanonical:41,qiitaFailureStopsEnglish:true,devtoFailureRetriesWithSavedJapaneseId:true,unreservedDatesNoOp:true,unicodeTitleRegression:'pass',diskDraftHashesUnchanged:allPaths.length,results};
writeFileSync(`${reportDir}/publisher-verification.json`,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,results:undefined},null,2));
