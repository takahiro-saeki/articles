import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { basename } from 'node:path';
import vm from 'node:vm';
const ref='8a1bfa8';
const original=execFileSync('git',['show',`${ref}:scripts/publish-scheduled.mjs`],{encoding:'utf8'});
const source=original.replace(/^import .*;\n/gm,'');
assert.equal((original.match(/^import /gm)??[]).length,2);
const ja='public/example.md', en='devto/example.md';
function fixture() {
  return {files:new Map([
    ['schedule/publishing-schedule.json',JSON.stringify([{date:'2026-09-01',platform:'qiita',source:ja,devto:en}])],
    [ja,'---\ntitle: example\ntags:\n  - JavaScript\nprivate: false\nid: null\nignorePublish: true\n---\nExample.'],
    [en,'---\ntitle: example\ntags: javascript\npublished: false\n---\nExample.']
  ]),remote:{qiita:0,devto:0},calls:[]};
}
async function run(state,{failDevto=false,loseQiitaResponse=false,loseDevtoResponse=false,writeFailure=false,dryRun=false}={}) {
  const stop={exit:true};
  const context={
    basename, Set, Date, Intl, JSON, RegExp, Error,
    process:{argv:['node','script','--date=2026-09-01',...(dryRun?['--dry-run']:[])],env:{QIITA_TOKEN:'fake',DEVTO_API_KEY:'fake'},exit(){throw stop;}},
    console:{log(){}},
    readFileSync(path){assert(state.files.has(path));return state.files.get(path);},
    writeFileSync(path,value){if(writeFailure)throw Error('disk unavailable');state.files.set(path,value);},
    async fetch(url,options){
      const service=url.startsWith('https://qiita.com/api/v2/items')?'qiita':url.startsWith('https://dev.to/api/articles')?'devto':null;
      assert(service,'unexpected endpoint');
      state.calls.push(`${service}:${options.method}`);
      if(service==='devto'&&failDevto)return {ok:false,status:422,text:async()=> 'simulated invalid tag'};
      if(options.method==='POST')state.remote[service]++;
      if((service==='qiita'&&loseQiitaResponse)||(service==='devto'&&loseDevtoResponse))throw Error('response lost after acceptance');
      return {ok:true,json:async()=>({id:service==='qiita'?'known-qiita-id':101,url:`https://example.invalid/${service}/known`,updated_at:'2026-09-01T00:00:00Z'})};
    }
  };
  try {await vm.runInNewContext(`(async()=>{${source}\n})()`,context);return 'ok';}
  catch(error){return error===stop?'ok':error.message;}
}
const results=[];
{
  const s=fixture(); await run(s); s.calls=[]; await run(s);
  assert.deepEqual(s.calls,[]); results.push({case:'both metadata saved',retryCalls:s.calls,remote:s.remote});
}
{
  const s=fixture(); assert.match(await run(s,{failDevto:true}),/422/);s.calls=[];await run(s);
  assert.deepEqual(s.calls,['qiita:PATCH','devto:POST']);assert.deepEqual(s.remote,{qiita:1,devto:1});results.push({case:'devto rejects; qiita id saved',retryCalls:s.calls,remote:s.remote});
}
{
  const s=fixture();await run(s,{loseQiitaResponse:true});s.calls=[];await run(s);
  assert.equal(s.remote.qiita,2);results.push({case:'qiita accepted; response lost',retryCalls:s.calls,remote:s.remote});
}
{
  const s=fixture();await run(s,{loseDevtoResponse:true});s.calls=[];await run(s);
  assert.equal(s.remote.devto,2);results.push({case:'devto accepted; response lost',retryCalls:s.calls,remote:s.remote});
}
{
  const s=fixture();await run(s,{writeFailure:true});s.calls=[];await run(s);
  assert.equal(s.remote.qiita,2);results.push({case:'qiita accepted; local write fails',retryCalls:s.calls,remote:s.remote});
}
{
  const s=fixture();await run(s,{dryRun:true});assert.deepEqual(s.calls,[]);results.push({case:'dry run',calls:s.calls,remote:s.remote});
}
console.log(JSON.stringify({ref,environment:process.version,network:'mock only; no real API calls',cases:results.length,results},null,2));
