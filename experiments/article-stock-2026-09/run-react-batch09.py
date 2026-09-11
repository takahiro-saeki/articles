"""Build isolated browser fixtures and drive real DOM events through Playwright CLI."""
import functools, http.server, json, pathlib, subprocess, tempfile, threading
ROOT = pathlib.Path(__file__).resolve().parents[2]
EXP = ROOT/'experiments/article-stock-2026-09/react-batch09'
OUT = ROOT/'production/2026-09/batch-09'
PW = ROOT/'output/playwright/batch09-react'; PW.mkdir(parents=True, exist_ok=True)
CLI = ['bash', str(pathlib.Path.home()/'.codex/skills/playwright/scripts/playwright_cli.sh'), '-s=article-react-batch9']
records = []
def cli(*args):
    p = subprocess.run([*CLI, *args], cwd=PW, text=True, capture_output=True, timeout=90)
    if p.returncode: raise RuntimeError(p.stdout+p.stderr)
    return p.stdout.strip()
def evaluate(code): return json.loads(cli('--raw', 'eval', code))
def pw(code): return cli('run-code', 'async (page) => { '+code+' }')
def save(): (OUT/'browser-results.json').write_text(json.dumps({'records':records},indent=2)+'\n')
def run_case(environment, kind, options, code):
    evaluate(f'() => {{ window.setupCase({json.dumps(kind)}, {json.dumps(options)}); return true; }}')
    cli('snapshot')
    pw(code)
    result = evaluate('window.caseResult')
    records.append({'environment':environment, 'kind':kind, 'options':options, 'result':result})
    save()
    print(json.dumps({'case':len(records),'kind':kind,'options':options,'result':result},separators=(',',':')),flush=True)
    return result
KEYS = '''
const read = () => page.evaluate(() => Array.from(document.querySelectorAll('[data-row]')).map(label => ({id:label.dataset.row, value:label.querySelector('input').value, original:window.nodeOrigins.get(label.querySelector('input'))})));
await page.locator('[data-row="B"] input').fill('edited-B');
await page.evaluate(() => { window.nodeOrigins = new WeakMap(Array.from(document.querySelectorAll('[data-row]')).map(label => [label.querySelector('input'),label.dataset.row])); });
const before = await read();
await page.locator('#remove-first').click();
await page.waitForFunction(() => document.querySelectorAll('[data-row]').length === 2);
const after = await read();
await page.evaluate(data => window.caseResult=data, {before,after});
'''
EFFECTS = '''
await page.waitForFunction(() => window.readTrace().events.some(x => x.startsWith('setup:')));
const mounted = await page.evaluate(() => window.readTrace());
await page.locator('#send-local').click();
const emitted = await page.evaluate(() => window.readTrace());
await page.locator('#change-room').click();
await page.waitForFunction(() => window.readTrace().events.includes('setup:B'));
const changed = await page.evaluate(() => window.readTrace());
await page.evaluate(() => window.unmountCase());
const unmounted = await page.evaluate(() => window.readTrace());
await page.evaluate(data => window.caseResult=data, {mounted,emitted,changed,unmounted});
'''
FORMS = '''
const initial = await page.evaluate(() => window.readTrace());
await page.locator('[name="field-0"]').fill('edited');
const typed = await page.evaluate(() => window.readTrace());
await page.locator('#read-form').click();
const submitted = await page.evaluate(() => window.readTrace().submitted);
await page.locator('#native-reset').click();
const nativeReset = await page.locator('[name="field-0"]').inputValue();
await page.locator('#explicit-reset').click();
await page.waitForFunction(() => document.querySelector('[name="field-0"]').value === 'field-0');
const explicitReset = await page.locator('[name="field-0"]').inputValue();
await page.evaluate(data => window.caseResult=data, {initial,delta:{form:typed.formRenders-initial.formRenders,fields:typed.fieldRenders-initial.fieldRenders,changes:typed.fieldChanges-initial.fieldChanges},submittedCount:Object.keys(submitted).length,submittedFirst:submitted['field-0'],nativeReset,explicitReset});
'''
REFS = '''
await page.evaluate(() => window.originalObserved = document.getElementById('observed'));
const mounted = await page.evaluate(() => window.readTrace());
await page.locator('#rerender').click();
const updated = await page.evaluate(() => ({...window.readTrace(),sameNode:window.originalObserved===document.getElementById('observed')}));
await page.evaluate(() => window.unmountCase());
const unmounted = await page.evaluate(() => window.readTrace());
await page.evaluate(data => window.caseResult=data, {mounted,updated,unmounted});
'''
STORE = '''
await page.waitForFunction(() => window.readStore().subscribers===1);
const read = () => page.evaluate(() => ({dom:document.getElementById('store-count').textContent,...window.readStore(),trace:window.readTrace()}));
const initial = await read();
await page.evaluate(() => window.updateStore('mutate',1));
const mutated = await read();
await page.evaluate(() => window.updateStore('replace',2));
await page.waitForFunction(() => document.getElementById('store-count').textContent==='2');
const replaced = await read();
await page.evaluate(() => window.unmountCase());
const subscribersAfterUnmount = await page.evaluate(() => window.readStore().subscribers);
await page.evaluate(data => window.caseResult=data, {initial,mutated,replaced,subscribersAfterUnmount});
'''
QUEUE = '''
await page.locator('#queue-two').click();
await page.waitForFunction(() => window.readTrace().calls.length===1 && document.getElementById('action-pending').textContent==='true');
const read = () => page.evaluate(() => ({trace:window.readTrace(),state:JSON.parse(document.getElementById('action-state').textContent),pending:document.getElementById('action-pending').textContent}));
const first = await read();
await page.evaluate(() => window.resolveAction());
await page.waitForFunction(() => window.readTrace().calls.length===2);
const second = await read();
await page.evaluate(() => window.resolveAction());
await page.waitForFunction(() => document.getElementById('action-pending').textContent==='false');
const finished = await read();
await page.evaluate(data => window.caseResult=data, {queue:true,first,second,finished});
'''
with tempfile.TemporaryDirectory(prefix='article-react-batch09-') as tmp:
    environment = json.loads(subprocess.check_output(['node',str(EXP/'build.mjs'),tmp],text=True))
    assert environment['packages']['react'] == environment['packages']['react-dom'] == '19.3.0'
    assert 'Missing getServerSnapshot' in environment['ssr']['missingSnapshotError']
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self,*args): pass
    server = http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=tmp))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    url=f'http://127.0.0.1:{server.server_port}'
    try:
        print(cli('open',url+'/production.html'),flush=True)
        pw('await page.waitForFunction(() => window.ready);')
        environment['browser'] = evaluate('navigator.userAgent')
        (OUT/'environment.json').write_text(json.dumps(environment,indent=2)+'\n')
        for mode in ['uncontrolled','local','parent']:
            for key_mode in ['index','id']:
                result=run_case('production','keys',{'mode':mode,'keyMode':key_mode},KEYS)
                expected=['edited-B','Gamma'] if key_mode=='id' or mode=='parent' else ['Alpha','edited-B']
                assert [x['value'] for x in result['after']]==expected
                assert [x['original'] for x in result['after']]==(['B','C'] if key_mode=='id' else ['A','B'])
        for mode in ['root','local','uncontrolled']:
            for size in [10,100,500]:
                result=run_case('production','forms',{'mode':mode,'size':size},FORMS)
                assert result['delta']=={'form':int(mode=='root'),'fields':size if mode=='root' else int(mode=='local'),'changes':int(mode!='uncontrolled')}
                assert result['submittedCount']==size and result['submittedFirst']=='edited'
                assert result['explicitReset']=='field-0'
        result=run_case('production','store',{},STORE)
        assert result['mutated']['dom']=='0' and result['mutated']['count']==1
        assert result['replaced']['dom']=='2' and result['subscribersAfterUnmount']==0
        for kind,name in [('action','good'),('manual','good'),('action','bad'),('manual','bad'),('action','crash'),('manual','crash'),('preserve','bad'),('preserve','good')]:
            code='''
await page.locator('#action-input').fill(NAME);
await page.locator('#action-submit').click();
await page.waitForFunction(() => window.readTrace().calls.length===1 && document.getElementById('action-pending').textContent==='true');
const pending=await page.evaluate(() => ({trace:window.readTrace(),pending:document.getElementById('action-pending').textContent,input:document.getElementById('action-input').value}));
await page.evaluate(() => window.resolveAction());
await page.waitForFunction(() => document.getElementById('action-error') || document.getElementById('action-pending').textContent==='false');
const finished=await page.evaluate(() => ({trace:window.readTrace(),error:document.getElementById('action-error')?.textContent??null,state:document.getElementById('action-state')?JSON.parse(document.getElementById('action-state').textContent):null,input:document.getElementById('action-input')?.value??null}));
await page.evaluate(data => window.caseResult=data,{name:NAME,pending,finished});
'''.replace('NAME',json.dumps(name))
            result=run_case('production',kind,{},code)
            if name=='crash' and kind=='action': assert result['finished']['error']=='simulated failure'
            else:
                assert result['finished']['input']==('' if kind=='action' or kind=='preserve' and name=='good' else name)
                assert result['finished']['state']['message']==({'good':'saved:good','bad':'invalid','crash':'simulated failure'}[name])
        result=run_case('production','action',{},QUEUE)
        assert len(result['first']['trace']['calls'])==1
        assert result['second']['trace']['calls'][1]['previous']['count']==1
        assert result['second']['pending']=='true'
        assert result['finished']['state']['count']==2
        for build in ['production','development']:
            if build=='development':
                print(cli('goto',url+'/development.html'),flush=True)
                pw('await page.waitForFunction(() => window.ready);')
            effects=[{'strict':True,'nested':False,'cleanup':True}]
            if build=='development': effects += [{'strict':False,'nested':False,'cleanup':True},{'strict':False,'nested':True,'cleanup':True},{'strict':True,'nested':False,'cleanup':False}]
            for options in effects:
                result=run_case(build,'effects',options,EFFECTS)
                if options['cleanup']:
                    assert [result[x]['active'] for x in ['mounted','changed','unmounted']]==[1,1,0]
                else: assert [result[x]['active'] for x in ['mounted','changed','unmounted']]==[2,3,3]
            for stable,legacy in [(True,False),(False,False),(True,True)]:
                result=run_case(build,'refs',{'strict':True,'stable':stable,'legacy':legacy},REFS)
                assert [result[x]['active'] for x in ['mounted','updated','unmounted']]==[1,1,0]
                assert result['updated']['sameNode']
        for mode in ['matching','mismatched']:
            print(cli('goto',url+'/'+mode+'.html'),flush=True)
            pw("await page.waitForFunction(() => window.readHydration && window.readHydration().count==='1');")
            result=evaluate('window.readHydration()')
            assert bool(result['errors'])==(mode=='mismatched')
            assert result['renders'][0]==(0 if mode=='matching' else 2)
            records.append({'kind':'hydration','environment':'development','options':{'mode':mode},'result':result});save()
            print(json.dumps({'hydration':mode,'result':result}),flush=True)
        print(f'All {len(records)} browser cases passed.',flush=True)
    finally:
        print(cli('close'),flush=True)
        server.shutdown()
