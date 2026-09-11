import functools, http.server, json, pathlib, subprocess, tempfile, threading
ROOT=pathlib.Path(__file__).resolve().parents[2]
OUT=ROOT/'production/2026-09/batch-07'
PW=ROOT/'output/playwright/batch07-suspense'; PW.mkdir(parents=True,exist_ok=True)
CLI=['bash',str(pathlib.Path.home()/'.codex/skills/playwright/scripts/playwright_cli.sh'),'-s=article-suspense-batch7']
def cli(*args):
    p=subprocess.run([*CLI,*args],cwd=PW,capture_output=True,text=True)
    if p.returncode: raise RuntimeError(p.stdout+p.stderr)
    return p.stdout.strip()
def evaluate(code): return json.loads(cli('--raw','eval',code))
def pw(code): return cli('run-code','async (page) => { '+code+' }')
STATE='''() => {
  const visible = id => {
    let el=document.getElementById(id);
    if (!el) return false;
    for (;el;el=el.parentElement) if (getComputedStyle(el).display==='none') return false;
    return true;
  };
  return {shell:visible('shell'), fallback:visible('fallback'), result:visible('result')?document.getElementById('result').textContent:null, pending:document.getElementById('pending').textContent, input:document.getElementById('query')?.value??null};
}'''
with tempfile.TemporaryDirectory(prefix='article-suspense-') as tmp:
    p=pathlib.Path(tmp)
    (p/'bench.tsx').write_bytes(pathlib.Path(__file__).with_name('suspense-boundary-bench.tsx').read_bytes())
    build='''const {createRequire}=require('module'); const req=createRequire(process.argv[1]+'/package.json');
      req('esbuild').buildSync({entryPoints:[process.argv[2]+'/bench.tsx'],outfile:process.argv[2]+'/bundle.js',bundle:true,minify:true,platform:'browser',define:{'process.env.NODE_ENV':'"production"'},nodePaths:[process.argv[1]+'/node_modules'],jsx:'transform'});
      console.log(JSON.stringify(Object.fromEntries(['react','react-dom','esbuild'].map(n=>[n,req(n+'/package.json').version]))));'''
    versions=json.loads(subprocess.check_output(['node','-e',build,str(ROOT.parent/'circle-hub/apps/web'),tmp],text=True))
    assert versions=={'react':'19.2.5','react-dom':'19.2.5','esbuild':'0.27.4'}
    (p/'index.html').write_text('<!doctype html><title>Suspense boundaries</title><div id="root"></div><script src="bundle.js"></script>')
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self,*args): pass
    server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=tmp))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    records=[]
    try:
        print(cli('open',f'http://127.0.0.1:{server.server_port}/'),flush=True)
        for mode in ['broad-urgent','narrow-urgent','broad-transition','narrow-transition','narrow-transition-key']:
            evaluate(f'() => {{window.setupCase("{mode}"); return true}}')
            pw('await page.locator("#fallback").waitFor({state:"visible"});')
            initial=evaluate(STATE)
            assert initial['fallback'] and initial['shell']==mode.startswith('narrow')
            evaluate('() => {window.resolveGate(); return true}')
            pw('await page.getByText("Result 0",{exact:true}).waitFor({state:"visible"}); await page.locator("#query").fill("typed");')
            loaded=evaluate(STATE)
            pw('await page.locator("#update").click();')
            transition='transition' in mode and not mode.endswith('-key')
            if transition: pw('await page.getByText("pending",{exact:true}).waitFor({state:"visible"});')
            else: pw('await page.locator("#fallback").waitFor({state:"visible"});')
            suspended=evaluate(STATE)
            assert suspended['fallback']==(not transition)
            assert suspended['result']==('Result 0' if transition else None)
            assert suspended['shell']==(mode!='broad-urgent')
            assert suspended['input']=='typed'
            evaluate('() => {window.resolveGate(); return true}')
            pw('await page.getByText("Result 1",{exact:true}).waitFor({state:"visible"});')
            resolved=evaluate(STATE)
            assert resolved=={'shell':True,'fallback':False,'result':'Result 1','pending':'idle','input':'typed'}
            records.append({'mode':mode,'initial':initial,'loaded':loaded,'suspended':suspended,'resolved':resolved})
        out={'versions':versions,'browser':evaluate('navigator.userAgent'),'records':records,'scope':'production React, manual stable Promise gates via use, DOM visibility and preserved input; no network or frame-duration benchmark; no custom throw-promise cache'}
        (OUT/'suspense-results.json').write_text(json.dumps(out,indent=2)+'\n')
        print(json.dumps(records),flush=True)
    finally:
        print(cli('close'),flush=True);server.shutdown()
