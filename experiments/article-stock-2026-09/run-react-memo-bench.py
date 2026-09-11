"""Build fixed production React and a fixed project formatter, run via Playwright CLI."""
import functools, hashlib, http.server, json, os, pathlib, statistics, subprocess, tempfile, threading
ROOT = pathlib.Path(__file__).resolve().parents[2]
REPOS = ROOT.parent
SOURCE_REV = '770de5f2989775cfd95f7a9c4529565a2b48d2fd'
CLI = ['bash', str(pathlib.Path.home() / '.codex/skills/playwright/scripts/playwright_cli.sh'), '-s=article-memo-batch6']
OUT = ROOT / 'production/2026-09/batch-06'
def run(args, **kwargs):
    return subprocess.check_output(args, text=True, **kwargs).strip()
def cli(*args):
    return run([*CLI, *args], cwd=ROOT / 'output/playwright/batch06')
def extract_json(value):
    # --raw is JSON for eval's returned object, without wrapper headings.
    return json.loads(value)
with tempfile.TemporaryDirectory(prefix='article-memo-') as tmp:
    p = pathlib.Path(tmp)
    source = subprocess.check_output(['git', '-C', str(REPOS/'circle-hub'), 'show', SOURCE_REV+':apps/web/src/lib/format-monthly-summary.ts'])
    (p/'source-format-monthly-summary.ts').write_bytes(source)
    (p/'bench.tsx').write_bytes((pathlib.Path(__file__).with_name('react-memoization-bench.tsx')).read_bytes())
    module_root = REPOS/'circle-hub/apps/web'
    build = r"""
const {createRequire}=require('module'); const req=createRequire(process.argv[1]+'/package.json');
const esbuild=req('esbuild'); const fs=require('fs');
const versions=Object.fromEntries(['react','react-dom','esbuild'].map(n=>[n,req(n+'/package.json').version]));
if(versions.react!=='19.2.5'||versions['react-dom']!=='19.2.5'||versions.esbuild!=='0.27.4') throw Error('Unexpected runtime: '+JSON.stringify(versions));
esbuild.buildSync({entryPoints:[process.argv[2]+'/bench.tsx'],outfile:process.argv[2]+'/bundle.js',bundle:true,minify:true,platform:'browser',define:{'process.env.NODE_ENV':'"production"'},nodePaths:[process.argv[1]+'/node_modules'],jsx:'transform'});
fs.writeFileSync(process.argv[2]+'/versions.json',JSON.stringify(versions));
"""
    subprocess.run(['node','-e',build,str(module_root),tmp],check=True)
    (p/'index.html').write_text('<!doctype html><meta charset="utf-8"><title>Article memo benchmark</title><p id="status">Loading</p><div id="root"></div><script src="bundle.js"></script>')
    class QuietHandler(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *args): pass
    server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(QuietHandler,directory=tmp))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    (ROOT/'output/playwright/batch06').mkdir(parents=True,exist_ok=True)
    try:
        print(cli('open',f'http://127.0.0.1:{server.server_port}/'),flush=True)
        print(cli('snapshot'),flush=True)
        for group in ['cheap','summary','callback']:
            result=extract_json(cli('--raw','eval',f'async () => await window.runBench("{group}")'))
            for values in result['results'].values():
                assert len(values)==9
                assert len({(x['calculations'],x['children'],x['outputLength'],x['output']) for x in values})==1
            outputs={x['output'] for values in result['results'].values() for x in values}
            assert len(outputs)==1
            if group=='cheap': assert outputs=={'43'*2000}
            result['summary']={k:{'medianMs':round(statistics.median(x['ms'] for x in v),3),'minMs':round(min(x['ms'] for x in v),3),'maxMs':round(max(x['ms'] for x in v),3),'calculations':v[0]['calculations'],'children':v[0]['children']} for k,v in result['results'].items()}
            (OUT/f'react-{group}.json').write_text(json.dumps(result,indent=2)+'\n')
            print(group,json.dumps(result['summary']),flush=True)
        meta={'sourceCommit':SOURCE_REV,'formatterSHA256':hashlib.sha256(source).hexdigest(),'versions':json.loads((p/'versions.json').read_text()),'node':run(['node','--version']),'cli':cli('--version'),'cpu':run(['sysctl','-n','machdep.cpu.brand_string']),'os':run(['sw_vers','-productVersion']),'mode':'production, compiler off, fresh headless browser, no CPU throttling, sync root updates; excludes paint and actual clipboard sharing'}
        (OUT/'react-environment.json').write_text(json.dumps(meta,indent=2)+'\n')
    finally:
        print(cli('close'),flush=True)
        server.shutdown()
