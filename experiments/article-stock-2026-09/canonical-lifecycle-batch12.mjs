import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import vm from 'node:vm';
const ref='6fe464919b7fba46d27395668d39d1e44b7f6964';
const results=[];
async function run({scheduled=true,platform='qiita',canonical='null',rejectQiita=false,dryRun=false}) {
 const path=scheduled?'scripts/publish-scheduled.mjs':'scripts/publish-devto.mjs';
 const original=execFileSync('git',['show',`${ref}:${path}`],{encoding:'utf8'});
 const code=original.replace(/^import .*;\n/gm,'');
 assert.equal((original.match(/^import /gm)??[]).length,scheduled?2:1);
 const ja=`${platform==='zenn'?'articles':'public'}/sample.md`, en='devto/sample.md';
 const files=new Map([
 ['schedule/publishing-schedule.json',JSON.stringify([{date:'2026-09-11',platform,source:ja,devto:en}])],
 [ja,'---\ntitle: Sample\ntags:\n  - JavaScript\nprivate: false\nid: null\nignorePublish: true\npublished: false\n---\nJapanese fixture.'],
 [en,`---\ntitle: Sample\ntags: javascript\ncanonical_url: ${canonical}\npublished: false\n---\nEnglish fixture.`]
 ]);
 const calls=[],writes=[];const stop={};let error=null;
 const responseUrl='https://qiita.com/fixture_author/items/0123456789abcdef0123';
 const context={basename,process:{argv:scheduled?['node','script','--date=2026-09-11',...(dryRun?['--dry-run']:[])]:['node','script',en],env:{QIITA_TOKEN:'mock',DEVTO_API_KEY:'mock'},exit(){throw stop;}},console:{log(){},error(){}},
 readFileSync(p){assert(files.has(p));return files.get(p);},writeFileSync(p,v){writes.push(p);files.set(p,v);},
 async fetch(url,options){
  const payload=JSON.parse(options.body);calls.push({url,method:options.method,payload});
  if(url.startsWith('https://qiita.com/')&&rejectQiita)return {ok:false,status:422,text:async()=> 'local fixture rejection'};
  return {ok:true,json:async()=>url.startsWith('https://qiita.com/')?{id:'0123456789abcdef0123',url:responseUrl,updated_at:'2026-09-11T00:00:00Z'}:{id:123,url:'https://dev.to/fixture_author/sample',published:scheduled}};
 }};
 try {await vm.runInNewContext(`(async()=>{${code}\n})()`,context);} catch(e){if(e!==stop)error=e.message;}
 return {path,platform,canonical,calls,writes,error,responseUrl,finalEnglish:files.get(en)};
}
let r=await run({});assert.equal(r.calls[1].payload.article.canonical_url,r.responseUrl);assert(r.finalEnglish.includes(`canonical_url: ${r.responseUrl}`));results.push({case:'scheduled Qiita response replaces null',...r});
r=await run({canonical:'https://zenn.dev/hirodeath/articles/stale-sample'});assert.equal(r.calls[1].payload.article.canonical_url,r.responseUrl);results.push({case:'scheduled Qiita response replaces stale URL',...r});
r=await run({rejectQiita:true});assert.equal(r.calls.length,1);assert.equal(r.writes.length,0);assert.match(r.error,/422/);results.push({case:'Qiita rejection stops before dev.to',...r});
r=await run({platform:'zenn'});assert.equal(r.calls.length,1);assert.equal(r.calls[0].payload.article.canonical_url,'https://zenn.dev/hirodeath/articles/sample');results.push({case:'Zenn uses source slug',...r});
r=await run({scheduled:false});assert.equal(r.calls[0].payload.article.canonical_url,'null');assert.equal(typeof r.calls[0].payload.article.canonical_url,'string');assert.equal(r.calls[0].payload.article.published,false);results.push({case:'standalone parser sends literal null string',...r});
r=await run({dryRun:true});assert.equal(r.calls.length,0);assert.equal(r.writes.length,0);results.push({case:'dry run makes no API call or write',...r});
const report={ref,node:process.version,mode:'original scripts with in-memory fs and fetch mocks; zero external calls',cases:results.length,results};
writeFileSync('production/2026-09/batch-12/canonical-experiment.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({cases:results.length,node:process.version,mode:report.mode}));
