"""Production Next probes. Runs only task-owned loopback servers and browser session."""
import collections, functools, gzip, hashlib, html, http.server, json, os, pathlib, re
import shutil, socket, subprocess, threading, time, urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[2]
APP = pathlib.Path(__file__).with_name('next-batch07')
OUT = ROOT/'production/2026-09/batch-07'
PW = ROOT/'output/playwright/batch07-next'
CLI = ['bash', str(pathlib.Path.home()/'.codex/skills/playwright/scripts/playwright_cli.sh'), '-s=article-next-batch7']
PW.mkdir(parents=True, exist_ok=True)
counts = collections.Counter()
class Origin(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        key = self.path.lstrip('/')
        counts[key] += 1
        body = json.dumps({'key': key, 'count': counts[key]}).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)
    def log_message(self, *args): pass

def cli(*args):
    if args[0] == 'run-code': args = ('run-code', 'async (page) => { ' + args[1] + ' }')
    p = subprocess.run([*CLI, *args], text=True, cwd=PW, capture_output=True)
    if p.returncode: raise RuntimeError(p.stdout + p.stderr)
    return p.stdout.strip()
def evaluate(code): return json.loads(cli('--raw', 'eval', code))
def http_get(path):
    with urllib.request.urlopen(base+path) as res: return res.read(), dict(res.headers)
def result(path):
    body, headers = http_get(path)
    match = re.search(rb'<pre id="result">(.*?)</pre>', body)
    assert match, path
    return {'value':json.loads(html.unescape(match[1].decode())), 'headers':headers}
def write(name, data): (OUT/name).write_text(json.dumps(data, indent=2)+'\n')
def normalize_log(path):
    path.write_text('\n'.join(line.rstrip() for line in path.read_text().splitlines()).rstrip()+'\n')

origin = http.server.HTTPServer(('127.0.0.1', 0), Origin)
threading.Thread(target=origin.serve_forever, daemon=True).start()
env = {**os.environ, 'ARTICLE_ORIGIN':f'http://127.0.0.1:{origin.server_port}', 'NEXT_TELEMETRY_DISABLED':'1'}
# Remove only this experiment's generated build to prevent a previous run's Data Cache.
shutil.rmtree(APP/'.next', ignore_errors=True)
with (OUT/'next-build.log').open('w') as log:
    subprocess.run(['npm','run','build'], cwd=APP, env=env, stdout=log, stderr=subprocess.STDOUT, check=True)
normalize_log(OUT/'next-build.log')
print('production build complete', dict(counts), flush=True)
build_counts = dict(counts)
with socket.socket() as sock:
    sock.bind(('127.0.0.1', 0)); port = sock.getsockname()[1]
base = f'http://127.0.0.1:{port}'
log = (OUT/'next-server.log').open('w')
server = subprocess.Popen(['node','node_modules/next/dist/bin/next','start','-H','127.0.0.1','-p',str(port)], cwd=APP, env=env, stdout=log, stderr=subprocess.STDOUT)
try:
    for _ in range(150):
        if server.poll() is not None: raise RuntimeError('Next server exited')
        try: http_get('/'); break
        except OSError: time.sleep(.1)
    else: raise TimeoutError('Next readiness')
    cache={'buildOriginCounts':build_counts,'requests':{}}
    for key in ['memo','data','full']:
        before=counts[key]
        responses=[result('/cache/'+key) for _ in range(3)]
        cache['requests'][key]={'before':before,'after':counts[key],'responses':responses}
    assert [x['value'] for x in cache['requests']['memo']['responses']] == [[{'key':'memo','count':n}]*2 for n in [1,2,3]]
    assert [x['value'] for x in cache['requests']['data']['responses']] == [[{'key':'data','count':1}]*2]*3
    assert cache['requests']['full']['after']==cache['requests']['full']['before']
    assert len({json.dumps(x['value']) for x in cache['requests']['full']['responses']})==1
    print(cli('open', base), flush=True)
    bundles={}
    for variant in ['broad','leaves','slot']:
        path='/bundle/'+variant
        body,_=http_get(path)
        scripts=sorted(set(html.unescape(x.decode()) for x in re.findall(rb'<script[^>]+src="([^"]+)"',body)))
        assert scripts and all(x.startswith('/_next/static/') for x in scripts)
        assets=[]
        for src in scripts:
            js,_=http_get(src)
            assets.append({'path':src,'bytes':len(js),'gzipBytes':len(gzip.compress(js,mtime=0)),'hasCatalogMarker':b'item-255-' in js})
        cli('goto',base+path)
        state=evaluate('() => ({catalog:[...document.querySelectorAll("#catalog li")].map(x=>x.textContent),buttons:[...document.querySelectorAll("button")].map(x=>x.textContent)})')
        assert len(state['catalog'])==256 and state['buttons']==['A: 0','B: 0']
        cli('run-code','await page.getByRole("button", {name:"A: 0",exact:true}).click(); await page.getByRole("button", {name:"B: 0",exact:true}).click();')
        after=evaluate('() => [...document.querySelectorAll("button")].map(x=>x.textContent)')
        assert after==['A: 1','B: 1']
        bundles[variant]={'assets':assets,'jsBytes':sum(x['bytes'] for x in assets),'jsGzipBytes':sum(x['gzipBytes'] for x in assets),'htmlBytes':len(body),'htmlGzipBytes':len(gzip.compress(body,mtime=0)),'dom':state,'interaction':after}
    assert bundles['broad']['dom']==bundles['leaves']['dom']==bundles['slot']['dom']
    assert any(x['hasCatalogMarker'] for x in bundles['broad']['assets'])
    assert not any(x['hasCatalogMarker'] for k in ['leaves','slot'] for x in bundles[k]['assets'])
    write('next-bundle.json',bundles)
    cli('goto',base+'/cache/router')
    def browser_value(): return evaluate('() => JSON.parse(document.querySelector("#result").textContent)')
    router=[{'step':'direct load','value':browser_value(),'originCount':counts['router']}]
    cli('run-code','await page.getByRole("link", {name:"Home",exact:true}).click(); await page.getByRole("heading", {name:"Local article experiments"}).waitFor();')
    cli('go-back')
    router.append({'step':'back after Link to Home','value':browser_value(),'originCount':counts['router']})
    cli('run-code','await page.getByRole("button", {name:"Refresh",exact:true}).click(); await page.waitForFunction(() => JSON.parse(document.querySelector("#result").textContent).count === 2);')
    router.append({'step':'router.refresh','value':browser_value(),'originCount':counts['router']})
    cli('run-code','await page.getByRole("link", {name:"Home",exact:true}).click(); await page.getByRole("heading", {name:"Local article experiments"}).waitFor(); await page.getByRole("link", {name:"Router probe",exact:true}).click(); await page.waitForFunction(() => JSON.parse(document.querySelector("#result").textContent).count === 3);')
    router.append({'step':'new Link navigation','value':browser_value(),'originCount':counts['router']})
    assert [r['originCount'] for r in router]==[1,1,2,3]
    cache['router']=router
    write('next-cache.json',cache)
    # Retain our source module membership, not a large vendor dump.
    stats=json.loads((APP/'client-modules.json').read_text()); own=[]
    def walk(modules):
        for m in modules:
            name=m.get('name','')
            if re.search(r'^\./(components/|data/generated-catalog)',name) and not m.get('modules'): own.append({k:m.get(k) for k in ['name','size','chunks']})
            walk(m.get('modules',[]))
    walk(stats.get('modules',[]))
    write('next-client-modules.json',own)
    versions=json.loads(subprocess.check_output(['node','-e','console.log(JSON.stringify(Object.fromEntries(["next","react","react-dom"].map(x=>[x,require(x+"/package.json").version]))))'],cwd=APP,text=True))
    write('next-environment.json',{'versions':versions,'node':subprocess.check_output(['node','--version'],text=True).strip(),'cli':cli('--version'),'browser':evaluate('navigator.userAgent'),'build':'production webpack','cacheComponents':False,'reactCompiler':False,'bundledReact':'19.3.0-canary-cbb046ab-20260731','prefetch':False,'scope':'loopback Node runtime, no CDN, no service worker, generated public catalog, initial HTML script assets; gzip is local recompression, not measured network transfer'})
    print(json.dumps({'bundle':{k:{x:v[x] for x in ['jsBytes','jsGzipBytes','htmlBytes','htmlGzipBytes']} for k,v in bundles.items()},'origin':dict(counts),'router':router}),flush=True)
finally:
    try: print(cli('close'),flush=True)
    finally:
        server.terminate(); server.wait(timeout=15); log.close(); origin.shutdown()
        normalize_log(OUT/'next-server.log')
