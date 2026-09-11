import hashlib,json,pathlib,re,shlex,subprocess,tempfile

ROOT=pathlib.Path(__file__).resolve().parents[2]
OUT=ROOT/'production/2026-09/batch-14'
read=lambda name:json.loads((OUT/name).read_text())
sha=lambda data:hashlib.sha256(data).hexdigest()
git=lambda *args:subprocess.check_output(['git',*args],cwd=ROOT)
catalog=json.loads((ROOT/'production/2026-09/catalog.json').read_text())
selected=[x for x in catalog if x.get('batch')==14]
assert {x['id'] for x in selected}=={'T03','T26','T27','T30','T33'}
texts={x['id']:(ROOT/x['japanese']).read_text() for x in selected}
def blocks(text,language):return re.findall(r'^```'+language+r'\n([\s\S]*?)^```',text,re.M)
for x in selected:
    assert re.findall(r'^```([^\n]*)\n([\s\S]*?)^```',(ROOT/x['japanese']).read_text(),re.M)==re.findall(r'^```([^\n]*)\n([\s\S]*?)^```',(ROOT/x['english']).read_text(),re.M)
def node(code):return subprocess.check_output(['node','--input-type=module','-e',code],cwd=ROOT,text=True)
def run_ts(code):
    return node('import {stripTypeScriptTypes} from "node:module";new Function(stripTypeScriptTypes('+json.dumps(code)+'))();')
tsc=ROOT/'experiments/article-stock-2026-09/language-batch08/node_modules/typescript/bin/tsc'
with tempfile.TemporaryDirectory(prefix='article-b14-snippet-') as td:
    p=pathlib.Path(td)
    def compile_code(code):
        (p/'snippet.ts').write_text(code)
        (p/'tsconfig.json').write_text(json.dumps({'compilerOptions':{'strict':True,'noEmit':True,'target':'ES2022','module':'ESNext','types':[],'skipLibCheck':True},'files':['snippet.ts']}))
        result=subprocess.run(['node',str(tsc),'--project',str(p/'tsconfig.json'),'--pretty','false'],capture_output=True,text=True)
        codes=[int(x) for x in re.findall(r'error TS(\d+):',result.stdout+result.stderr)]
        assert result.returncode==0 or codes,result.stderr
        return codes
    any_code,guard_code=blocks(texts['T03'],'ts')
    assert compile_code(any_code)==[]
    assert compile_code(any_code.replace('value: any','value: unknown'))==[18046]
    observed=json.loads(node('import {stripTypeScriptTypes} from "node:module";try{new Function(stripTypeScriptTypes('+json.dumps(any_code)+'))();throw Error("Expected TypeError")}catch(e){console.log(JSON.stringify(e.name))}'))
    assert observed=='TypeError'
    guard_source=(ROOT/'experiments/article-stock-2026-09/batch14/ticket-statuses.ts').read_text().replace('export ','')
    assert guard_code==guard_source and compile_code(guard_code)==[]
    guard_probe='''
const values=[{data:[{status:"ok",id:"synthetic-ticket"},{status:"error"}]},{data:[]},{data:{}},{data:[{status:12}]},{data:[null]},null];
console.log(JSON.stringify(values.map(value=>{try{return {accepted:true,statuses:readTicketStatuses(value)}}catch(e){return {accepted:false,error:e.message}}})));
'''
    observed=json.loads(run_ts(guard_code+guard_probe))
    expected=[{k:v for k,v in item.items() if k!='name'} for item in read('unknown-experiment.json')['guard']]
    assert observed==expected
    routing=blocks(texts['T27'],'ts')[0]
    assert routing==(ROOT/'experiments/article-stock-2026-09/batch14/push-destination.ts').read_text().replace('export ','')
    assert compile_code(routing+'\nmakeExpoPayload({provider:"expo",token:"synthetic-device"});')==[]
    for provider in ['apns','fcm']:
        assert compile_code(routing+'\nmakeExpoPayload({provider:'+json.dumps(provider)+',token:"synthetic-device"});')==[2322]
    assert json.loads(run_ts(routing+'\nconsole.log(JSON.stringify(makeExpoPayload({provider:"expo",token:"synthetic-device"})));'))=={'to':'synthetic-device','title':'Routing example'}
storage=blocks(texts['T26'],'js')[0]
assert storage==(ROOT/'experiments/article-stock-2026-09/batch14/read-session-token.mjs').read_text().replace('export ','')
storage_probe='''
const observed=[];
for(const value of ["synthetic-credential",null,new Error("native failure")]){
  let calls=0;
  const result=await readSessionToken({getItemAsync:async(key)=>{if(key!=="session_token")throw Error("wrong key");calls++;if(value instanceof Error)throw value;return value}});
  observed.push({kind:result.kind,calls});
}
console.log(JSON.stringify(observed));
'''
assert json.loads(node(storage+storage_probe))==read('storage-experiment.json')['proposal_cases']
curl=read('aasa-curl-observation.json');http=read('aasa-http-observations.json')
assert shlex.split(blocks(texts['T30'],'sh')[0].replace('\\\n',''))==curl['command']
assert curl['bytes']==125 and all(x['bytes']==125 and x['sha256']==curl['sha256'] and x['body']==curl['body'] for x in http['results'])
assert json.loads(blocks(texts['T30'],'json')[0])==curl['body']['applinks']['details'][0]['paths']
aasa=read('aasa-experiment.json');assert len(aasa['checks'])==10
assert aasa['checks'][1]['observed']=='app-id-mismatch'
assert aasa['expected_app_ids']['development']=='3VDD942S97.com.squadnote.app.dev'
assert not any(aasa[k] for k in ['signed_entitlements_checked','ios_device_checked','apple_cdn_checked'])
assert not aasa['swcutil']['executed']
sources=read('repository-sources.json');assert len(sources)==10
for s in sources:
    data=subprocess.check_output(['git','-C',str(ROOT.parent/s['repository']),'show',s['commit']+':'+s['path']])
    assert sha(data)==s['sha256'] and len(data)==s['bytes']
pkg_ref=next(s for s in sources if s['path']=='apps/mobile/package.json')
pkg=json.loads(subprocess.check_output(['git','-C',str(ROOT.parent/pkg_ref['repository']),'show',pkg_ref['commit']+':'+pkg_ref['path']]))
assert json.loads(blocks(texts['T33'],'json')[0])=={'build:prod':pkg['scripts']['build:prod']}
assert '--auto-submit' not in pkg['scripts']['build:prod']
assert pkg['dependencies']['expo-notifications']=='~0.32.17'
assert read('eas-config-analysis.json')['commands_executed']==[]
assert read('storage-experiment.json')['actual_getToken_rejects_native_error']
assert not read('storage-experiment.json')['native_storage_tested']
assert not read('token-routing-experiment.json')['real_token_obtained']
assert read('token-routing-experiment.json')['notifications_sent']==0
unknown=read('unknown-experiment.json')
assert unknown['external_requests_sent']==0 and not unknown['database_used']
assert [(x['log_count'],x['deleted_token_count'],x['returned']) for x in unknown['actual_sender']]==[(0,0,'fulfilled'),(1,1,'fulfilled'),(0,0,'fulfilled'),(0,0,'fulfilled'),(1,0,'fulfilled'),(1,0,'fulfilled')]
audit=read('humanizer-audit.json');assert len(audit['files'])==10
for item in audit['files']:
    assert sha((ROOT/item['path']).read_bytes())==item['after_sha256']
    assert item['frontmatter_code_links_numeric_tokens_unchanged']
base=[p for p in git('ls-tree','-r','--name-only','8a1bfa8').decode().splitlines() if p!='ARTICLE_IDEAS_2026-09.md']
for p in base:assert (ROOT/p).read_bytes()==git('show','8a1bfa8:'+p),p
prior=[p for p in git('ls-tree','-r','--name-only','6b6632c','articles','public','devto').decode().splitlines() if p.endswith('.md')]
for p in prior:assert (ROOT/p).read_bytes()==git('show','6b6632c:'+p),p
strip=lambda s:re.sub(r'\n<!-- production-progress:start -->[\s\S]*?<!-- production-progress:end -->\n?','',s)
assert strip((ROOT/'ARTICLE_IDEAS_2026-09.md').read_text())==git('show','8a1bfa8:ARTICLE_IDEAS_2026-09.md').decode()
guard={'baseline':'8a1bfa8','before_batch':'6b6632c','baseline_files_unchanged':len(base),'previous_article_files_unchanged':len(prior),'original_ideas_unchanged':True,'fixed_git_sources':len(sources),'final_humanizer_hashes':10}
(OUT/'repository-guard.json').write_text(json.dumps(guard,indent=2)+'\n')
report={'pairs':5,'executable_blocks':5,'static_json_blocks':2,'text_blocks':1,'printed_unsafe_runtime_error':'TypeError','unknown_diagnostic':18046,'guard_cases':6,'storage_cases':3,'routing_cases':3,'aasa_comparison_cases':10,'actual_sender_cases':6,'printed_curl_previously_executed':True,'source_hashes':len(sources),'humanizer_prose_edits':sum(x['prose_edits'] for x in audit['files']),'guard':guard}
(OUT/'snippet-verification.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
