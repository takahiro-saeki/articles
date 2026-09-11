import hashlib,json,pathlib,re,subprocess
ROOT=pathlib.Path(__file__).resolve().parents[2]
OUT=ROOT/'production/2026-09/batch-15'
read=lambda name:json.loads((OUT/name).read_text())
sha=lambda b:hashlib.sha256(b).hexdigest()
git=lambda *args:subprocess.check_output(['git',*args],cwd=ROOT)
selected=[x for x in json.loads((ROOT/'production/2026-09/catalog.json').read_text()) if x.get('batch')==15]
assert {x['id'] for x in selected}=={'T29','T32','T35','T41','T43'}
texts={x['id']:(ROOT/x['japanese']).read_text() for x in selected}
def blocks(s,lang):return re.findall(r'^```'+lang+r'\n([\s\S]*?)^```',s,re.M)
for x in selected:
 assert re.findall(r'^```([^\n]*)\n([\s\S]*?)^```',(ROOT/x['japanese']).read_text(),re.M)==re.findall(r'^```([^\n]*)\n([\s\S]*?)^```',(ROOT/x['english']).read_text(),re.M)
def node(code):return json.loads(subprocess.check_output(['node','--input-type=module','-e',code],cwd=ROOT,text=True))
fixture=ROOT/'experiments/article-stock-2026-09/mobile-batch15'
initial=blocks(texts['T29'],'js')[0]
assert initial in (fixture/'trace.js').read_text()
initial_results=node('''const code='''+json.dumps(initial.replace('export ',''))+'''; const out=[];
for(const value of [null,'articlelab://detail?item=fixture']) {
 let calls=0; const records=[];
 const result=await new Function('Linking','trace',code+';return initialURL;')({getInitialURL:()=>{calls++;return Promise.resolve(value)}},(event,data)=>records.push({event,data}));
 out.push({calls,result,records});
}
console.log(JSON.stringify(out));''')
assert [x['calls'] for x in initial_results]==[1,1]
assert [x['result'] for x in initial_results]==[None,'articlelab://detail?item=fixture']
for x in initial_results:assert x['records']==[{'event':'initial-url','data':{'url':x['result']}}]
state=blocks(texts['T32'],'js')[0]
assert state.strip() in (fixture/'app/_layout.jsx').read_text()
state_result=node('''const code='''+json.dumps(state)+''';let listener;let removed=0;const records=[];
const subscription=new Function('AppState','trace',code+';return state;')({addEventListener:(event,callback)=>{if(event!=='change')throw Error(event);listener=callback;return {remove:()=>{listener=null;removed++}}}},(event,data)=>records.push({event,data}));
listener('background');subscription.remove();console.log(JSON.stringify({records,removed,listenerCleared:listener===null}));''')
assert state_result=={'records':[{'event':'app-state','data':{'value':'background'}}],'removed':1,'listenerCleared':True}
prevent,layout=blocks(texts['T35'],'js')
assert prevent in (fixture/'app/_layout.jsx').read_text()
normalize=lambda x:re.sub(r'\s+','',x)
assert normalize(layout) in normalize((fixture/'app/_layout.jsx').read_text())
splash_result=node('''const prevent='''+json.dumps(prevent)+''';const callback='''+json.dumps(layout)+''';const records=[];let prevents=0,hides=0;
const trace=(event,data={})=>records.push({event,data});const api={preventAutoHideAsync:()=>{prevents++;return Promise.resolve(true)},hideAsync:()=>{hides++;return Promise.resolve()}};
new Function('trace','SplashScreen',prevent)(trace,api);await Promise.resolve();
new Function('trace','SplashScreen','mode','authReady','return ('+callback+');')(trace,api,'coordinated',true)();await Promise.resolve();
console.log(JSON.stringify({records,prevents,hides}));''')
assert splash_result['prevents']==1 and splash_result['hides']==1
assert [x['event'] for x in splash_result['records']]==['prevent-request','prevent-result','content-layout','hide-request','hide-result']
assert splash_result['records'][3]['data']=={'mode':'coordinated','authReady':True}
js=read('mobile-js-experiment.json');assert len(js['initialURLCases'])==6 and len(js['appStateCases'])==6
assert not js['nativeAppExecuted']
assert js['initialURLCases'][3]['lateInitialDidNotChangeResult']
assert js['appStateCases'][0]['changeCalls']==0 and js['appStateCases'][0]['currentState']=='active'
assert js['appStateCases'][-1]['afterSuppliedResume']==2 and not js['appStateCases'][-1]['realNotificationAPI']
for x in js['sourceFiles']:
 data=(fixture/'node_modules'/x['specifier']).read_bytes();assert len(data)==x['bytes'] and sha(data)==x['sha256']
native=read('mobile-native-experiment.json');assert native['buildSucceeded'] and len(native['trials'])==2
records=[json.loads(s) for s in (OUT/'mobile-events.ndjson').read_text().splitlines()]
for trial in native['trials']:
 xs=sorted((x for x in records if x['boot']==trial['boot']),key=lambda x:x['sequence'])
 assert [x['event'] for x in xs]==trial['order']
 assert next(x for x in xs if x['event']=='initial-url')['data']['url'] is None
 ix={x['event']:x['sequence'] for x in xs}
 if trial['mode']=='early':assert ix['hide-request']<ix['auth-ready']<ix['content-layout'] and not trial['authReadyAtHide']
 else:assert ix['auth-ready']<ix['content-layout']<ix['hide-request'] and trial['authReadyAtHide']
 assert not trial['urlEvents']
for x in native['sourceFiles']:assert sha((ROOT/x['path']).read_bytes())==x['sha256']
assert read('ios-build-summary.json')['buildSucceeded']
worker=read('workers-runtime-experiment.json');assert len(worker['results'])==8
assert worker['results'][4]['completedAtObservation'] and not worker['results'][4]['cloudLimitMeasured']
assert [x['result']['found'] for x in worker['results'][5:]]==[False,False,True]
printed=read('printed-worker-experiment.json');assert printed['printedBlocksExecutedInWorkerd']==3 and printed['failureAfterResponse']
worker_source=(ROOT/'experiments/article-stock-2026-09/workers-batch15/worker.ts').read_text()
for code in blocks(texts['T41'],'ts'):assert normalize(code) in normalize(worker_source)
assert read('worker-typecheck.json')['source_sha256']==sha(worker_source.encode())
assert read('worker-typecheck.json')['exit_code']==0
browser=read('cache-browser-experiment.json');assert len(browser['cases'])==4
assert [x['afterTwo'] for x in browser['cases']]==[{'visits':2,'sources':2},{'visits':2,'sources':1},{'visits':1,'sources':1},{'visits':1,'sources':1}]
assert browser['cases'][-1]['afterPurge']=={'visits':1,'sources':1}
assert browser['cases'][-1]['afterReload']=={'visits':2,'sources':2}
assert browser['cacheStorage']['networkWasDifferent'] and browser['cacheStorage']['noServiceWorker']
printed_browser=read('printed-browser-experiment.json')
assert printed_browser['printedCode']==blocks(texts['T43'],'js')[0]
assert printed_browser['realBrowser'] and not printed_browser['cacheDisabled'] and not printed_browser['requestsIntercepted']
sources=read('repository-sources.json');assert len(sources)==8
for x in sources:
 data=subprocess.check_output(['git','-C',str(ROOT.parent/x['repository']),'show',x['commit']+':'+x['path']]);assert sha(data)==x['sha256'] and len(data)==x['bytes']
audit=read('humanizer-audit.json');assert len(audit['files'])==10
for x in audit['files']:assert sha((ROOT/x['path']).read_bytes())==x['after_sha256'] and x['frontmatter_code_links_numeric_tokens_unchanged']
base=[p for p in git('ls-tree','-r','--name-only','8a1bfa8').decode().splitlines() if p!='ARTICLE_IDEAS_2026-09.md']
for p in base:assert (ROOT/p).read_bytes()==git('show','8a1bfa8:'+p),p
prior=[p for p in git('ls-tree','-r','--name-only','2799b01','articles','public','devto').decode().splitlines() if p.endswith('.md')]
for p in prior:assert (ROOT/p).read_bytes()==git('show','2799b01:'+p),p
strip=lambda s:re.sub(r'\n<!-- production-progress:start -->[\s\S]*?<!-- production-progress:end -->\n?','',s)
assert strip((ROOT/'ARTICLE_IDEAS_2026-09.md').read_text())==git('show','8a1bfa8:ARTICLE_IDEAS_2026-09.md').decode()
guard={'baseline':'8a1bfa8','before_batch':'2799b01','baseline_files_unchanged':len(base),'previous_article_files_unchanged':len(prior),'original_ideas_unchanged':True,'fixed_git_sources':8,'fixed_package_sources':8,'native_fixture_sources':5,'final_humanizer_hashes':10}
(OUT/'repository-guard.json').write_text(json.dumps(guard,indent=2)+'\n')
report={'pairs':5,'code_blocks':9,'executable_blocks':8,'text_blocks':1,'printed_mobile_blocks_executed_with_substitute_boundaries':4,'printed_workerd_blocks_executed':3,'printed_browser_blocks_executed':1,'package_js_comparison_cases':12,'native_release_launches':2,'native_link_delivery_verified':False,'complete_native_resume_cycle_verified':False,'cloud_deployment':False,'humanizer_prose_edits':sum(x['prose_edits'] for x in audit['files']),'guard':guard}
(OUT/'snippet-verification.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
