import {execFileSync,spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {stripTypeScriptTypes} from 'node:module';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {readSessionToken} from './batch14/read-session-token.mjs';
import {matchesListedPrefix} from './batch14/aasa-prefix-check.mjs';
const repo='/Users/takahiro_saeki/Documents/GitHub/circle-hub-growth-07-schedule-import';
const commit='a34608c611ded6549c1176a7977e68e1bc62a8db';
const out='production/2026-09/batch-14';const references=[];
const tsc=resolve('experiments/article-stock-2026-09/language-batch08/node_modules/typescript/bin/tsc');
const tsVersion=execFileSync('node',[tsc,'--version'],{encoding:'utf8'}).trim().replace('Version ','');
function source(path){const bytes=execFileSync('git',['-C',repo,'show',`${commit}:${path}`]);references.push({repository:'circle-hub-growth-07-schedule-import',commit,path,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),last_change:execFileSync('git',['-C',repo,'log','-1','--format=%H %s',commit,'--',path],{encoding:'utf8'}).trim()});return bytes.toString();}
const push=source('apps/web/src/server/api/lib/expo-push.ts');
source('apps/mobile/src/lib/guest-response-store.ts');
const auth=source('apps/mobile/src/lib/auth.ts');
source('apps/mobile/src/lib/i18n.ts');
source('apps/mobile/src/lib/push-notifications.ts');
const config=source('apps/mobile/app.config.ts');
const aasaRoute=source('apps/web/src/app/.well-known/apple-app-site-association/route.ts');
const eas=JSON.parse(source('apps/mobile/eas.json'));
const pkg=JSON.parse(source('apps/mobile/package.json'));
source('docs/growth/README.md');
const temporary=mkdtempSync(join(tmpdir(),'article-b14-'));
function compile(name,code){const path=join(temporary,name+'.ts');writeFileSync(path,code);const project=join(temporary,'tsconfig.json');writeFileSync(project,JSON.stringify({compilerOptions:{strict:true,noEmit:true,target:'ES2022',module:'ESNext',types:[],skipLibCheck:true},files:[path]}));const r=spawnSync('node',[tsc,'--project',project,'--pretty','false'],{encoding:'utf8'});const output=r.stdout+r.stderr;const diagnostics=[...output.matchAll(/error TS(\d+): ([^\n]+)/g)].map(m=>({code:Number(m[1]),message:m[2]}));assert(r.status===0||diagnostics.length>0,output);return {name,diagnostics};}
const payload='{"data":{"unexpected":true}}';
const anyCode=`const value: any = JSON.parse(${JSON.stringify(payload)});value.data[0].status.toUpperCase();`;
const unknownCode=`const value: unknown = JSON.parse(${JSON.stringify(payload)});value.data[0].status.toUpperCase();`;
const assertedCode=`interface Reply {data: Array<{status: "ok" | "error"}>}; const value = JSON.parse(${JSON.stringify(payload)}) as Reply;value.data[0].status.toUpperCase();`;
const compileResults=[compile('any',anyCode),compile('unknown',unknownCode),compile('asserted',assertedCode)];
assert.equal(compileResults[0].diagnostics.length,0);assert.deepEqual(compileResults[1].diagnostics.map(x=>x.code),[18046]);assert.equal(compileResults[2].diagnostics.length,0);
const runtimeUnsafe=[];for(const[name,code]of [['any',anyCode],['asserted',assertedCode]]){try{new Function(stripTypeScriptTypes(code))();assert.fail('expected error');}catch(e){assert(e instanceof TypeError);runtimeUnsafe.push({name,error:e.name});}}
const guardTS=readFileSync('experiments/article-stock-2026-09/batch14/ticket-statuses.ts','utf8');assert.equal(compile('guard',guardTS).diagnostics.length,0);
const {readTicketStatuses}=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(guardTS)).toString('base64'));
const guardCases=[];for(const[name,value,passes]of [['normal',{data:[{status:'ok',id:'synthetic-ticket'},{status:'error'}]},true],['empty',{data:[]},true],['data-object',{data:{}},false],['number-status',{data:[{status:12}]},false],['null-ticket',{data:[null]},false],['null-body',null,false]]){let result;try{result={accepted:true,statuses:readTicketStatuses(value)}}catch(e){result={accepted:false,error:e.message}}assert.equal(result.accepted,passes);guardCases.push({name,...result});}
const pushJS=stripTypeScriptTypes(push.replace(/^import[^\n]*\n/gm,'')).replaceAll('export async function','async function');
const sendCases=[];
for(const[name,body,status,expectedLogs,expectedDeletes]of [['ok',{data:[{status:'ok',id:'synthetic-ticket'}]},200,0,0],['unregistered',{data:[{status:'error',details:{error:'DeviceNotRegistered'}}]},200,1,1],['data-object',{data:{unexpected:true}},200,0,0],['number-status',{data:[{status:12}]},200,0,0],['null-body',null,200,1,0],['http-error',{},503,1,0]]){
 const logs=[],deletes=[],requests=[];const fetchStub=async(url,options)=>{requests.push({url,method:options.method});return {ok:status===200,status,json:async()=>body,text:async()=>'{synthetic HTTP error}'}};
 const db={delete:()=>({where:async tokens=>{deletes.push(...tokens)}})};
 const send=new Function('fetch','console','pushTokens','inArray',pushJS+';return sendExpoPush;')(fetchStub,{error:(...args)=>logs.push(String(args[0]))},{token:'mock-token-column'},(_column,tokens)=>tokens);
 await send(db,[{to:'synthetic-device',title:'Local fixture'}]);assert.equal(logs.length,expectedLogs);assert.equal(deletes.length,expectedDeletes);assert.equal(requests.length,1);
 sendCases.push({name,status,log_count:logs.length,deleted_token_count:deletes.length,returned:'fulfilled'});
}
writeFileSync(`${out}/unknown-experiment.json`,JSON.stringify({node:process.version,typescript:tsVersion,commit,compiler_options:'strict, ES2022, noEmit, types=[]',compile:compileResults,runtime_unsafe:runtimeUnsafe,guard:guardCases,actual_sender:sendCases,external_requests_sent:0,database_used:false},null,2)+'\n');
const storageCases=[];for(const[kind,result]of [['value','synthetic-credential'],['missing',null],['unavailable',new Error('synthetic native failure')]]){let calls=0;const observed=await readSessionToken({getItemAsync:async()=>{calls++;if(result instanceof Error)throw result;return result}});assert.equal(observed.kind,kind);assert.equal(calls,1);storageCases.push({kind,calls});}
const authJS=stripTypeScriptTypes(auth.replace(/^import[^\n]*\n/gm,'')).replaceAll('export async function','async function');
const actualGetToken=new Function('SecureStore',authJS+';return getToken;')({getItemAsync:async()=>{throw new Error('synthetic native failure')}});await assert.rejects(actualGetToken(),/synthetic native failure/);
writeFileSync(`${out}/storage-experiment.json`,JSON.stringify({node:process.version,proposal_cases:storageCases,actual_getToken_rejects_native_error:true,native_storage_tested:false,async_storage_dependency_present:'@react-native-async-storage/async-storage' in pkg.dependencies,source_secure_store_range:pkg.dependencies['expo-secure-store']},null,2)+'\n');
const destinationTS=readFileSync('experiments/article-stock-2026-09/batch14/push-destination.ts','utf8');
const routingCompile=[compile('expo-routing',destinationTS+'\nmakeExpoPayload({provider:"expo",token:"synthetic-device"});'),compile('apns-to-expo',destinationTS+'\nmakeExpoPayload({provider:"apns",token:"synthetic-device"});'),compile('fcm-to-expo',destinationTS+'\nmakeExpoPayload({provider:"fcm",token:"synthetic-device"});')];
assert.equal(routingCompile[0].diagnostics.length,0);assert(routingCompile.slice(1).every(x=>x.diagnostics.length>0));
writeFileSync(`${out}/token-routing-experiment.json`,JSON.stringify({typescript:tsVersion,cases:routingCompile,real_token_obtained:false,notifications_sent:0,source_client_method:'getExpoPushTokenAsync',source_server_endpoint:'https://exp.host/--/api/v2/push/send'},null,2)+'\n');
const configFunction=new Function('process',stripTypeScriptTypes(config).replace('export default','return'));
const configs={};for(const env of ['production','development']){const c=configFunction({env:{APP_ENV:env}})({config:{}});configs[env]={bundleIdentifier:c.ios.bundleIdentifier,associatedDomains:c.ios.associatedDomains,version:c.version,runtimeVersion:c.runtimeVersion,plugins:c.plugins.map(x=>Array.isArray(x)?x[0]:x)};}
const aasaJS=stripTypeScriptTypes(aasaRoute.replace(/^import[^\n]*\n/gm,'')).replaceAll('export const','const').replaceAll('export function','function');
const fixedAasa=new Function('NextResponse',aasaJS+';return GET();')({json:value=>value});
const http=JSON.parse(readFileSync(`${out}/aasa-http-observations.json`));assert.deepEqual(http.results[0].body,fixedAasa);
function inspect(status,contentType,body,appID,url){if(status>=300&&status<400)return 'redirect';if(status!==200)return 'http-error';if(contentType.split(';')[0].trim()!=='application/json')return 'content-type';let parsed;try{parsed=typeof body==='string'?JSON.parse(body):body}catch{return 'invalid-json'};if(!Array.isArray(parsed?.applinks?.details))return 'unsupported-format';if(parsed.applinks.details.some(x=>'components' in x||'appIDs' in x))return 'unsupported-format';const entry=parsed.applinks.details.find(x=>x.appID===appID);if(!entry)return 'app-id-mismatch';if(!Array.isArray(entry.paths))return 'unsupported-format';try{return matchesListedPrefix(url,entry.paths)?'listed-prefix':'path-not-listed'}catch{return 'unsupported-rule'}}
const prodID=fixedAasa.applinks.details[0].appID;
const devID=prodID.slice(0,prodID.indexOf('.')+1)+configs.development.bundleIdentifier;
const checks=[];const baseUrl='https://squad-note.com';
for(const[name,status,type,body,id,url,expected]of [
 ['production-invite',200,'application/json',http.results[0].body,prodID,baseUrl+'/invite/demo','listed-prefix'],
 ['development-bundle',200,'application/json',http.results[1].body,devID,'https://dev.squad-note.com/invite/demo','app-id-mismatch'],
 ['settings',200,'application/json',fixedAasa,prodID,baseUrl+'/settings','path-not-listed'],
 ['redirect',302,'application/json',fixedAasa,prodID,baseUrl+'/invite/demo','redirect'],
 ['html-content-type',200,'text/html',fixedAasa,prodID,baseUrl+'/invite/demo','content-type'],
 ['invalid-json',200,'application/json','{',prodID,baseUrl+'/invite/demo','invalid-json'],
 ['modern-components',200,'application/json',{applinks:{details:[{appIDs:[prodID],components:[{'/':'/invite/*'}]}]}},prodID,baseUrl+'/invite/demo','unsupported-format'],
 ['case-change',200,'application/json',fixedAasa,prodID,baseUrl+'/Invite/demo','path-not-listed'],
 ['query-and-fragment',200,'application/json',fixedAasa,prodID,baseUrl+'/invite/demo?openExternalBrowser=1#check','listed-prefix'],
 ['missing-slash',200,'application/json',fixedAasa,prodID,baseUrl+'/invite','path-not-listed']
]){const observed=inspect(status,type,body,id,url);assert.equal(observed,expected);checks.push({name,observed})}
writeFileSync(`${out}/aasa-experiment.json`,JSON.stringify({node:process.version,macos:execFileSync('sw_vers',['-productVersion'],{encoding:'utf8'}).trim(),source_commit:commit,configured_apps:configs,expected_app_ids:{production:prodID,development:devID},origin_bodies_equal:JSON.stringify(http.results[0].body)===JSON.stringify(http.results[1].body),checks,checker_scope:'Only positive legacy prefix rules ending in /*; not Apple OS verification',swcutil:{executed:false,reason:'swcutil requires root; sudo -n reported a password is required. No privileged verification or password prompt performed.'},signed_entitlements_checked:false,ios_device_checked:false,apple_cdn_checked:false},null,2)+'\n');
writeFileSync(`${out}/eas-config-analysis.json`,JSON.stringify({commit,source_expo_range:pkg.dependencies.expo,source_update_range:pkg.dependencies['expo-updates'],scripts:Object.fromEntries(Object.entries(pkg.scripts).filter(([,value])=>value.includes('eas '))),build_profile_summary:Object.fromEntries(Object.entries(eas.build).map(([k,v])=>[k,{channel:v.channel,distribution:v.distribution??null,autoIncrement:v.autoIncrement??false}])),configured_apps:configs,commands_executed:[]},null,2)+'\n');
writeFileSync(`${out}/repository-sources.json`,JSON.stringify(references,null,2)+'\n');
rmSync(temporary,{recursive:true});
console.log(`Verified compiler cases, 6 actual sender responses, 6 status guards, 3 storage outcomes, 3 routing types and 10 AASA checks; captured ${references.length} fixed sources. No external writes.`);
