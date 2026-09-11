"""Build task-owned Next fixtures and inspect HTTP, real browser DOM, and failures."""
import hashlib
import html
import json
import os
from pathlib import Path
import re
import shutil
import socket
import struct
import subprocess
import tempfile
import time
import urllib.error
import urllib.request
import zlib

ROOT = Path(__file__).resolve().parents[2]
APP = Path(__file__).with_name('next-batch10')
OUT = ROOT / 'production/2026-09/batch-10'
PW = ROOT / 'output/playwright/batch10-next'
PW.mkdir(parents=True, exist_ok=True)
CLI = ['bash', str(Path.home() / '.codex/skills/playwright/scripts/playwright_cli.sh'), '-s=article-next-batch10']
ENV = {**os.environ, 'NEXT_TELEMETRY_DISABLED': '1', 'ARTICLE_SERVER_LABEL': 'server-build-A', 'NEXT_PUBLIC_ARTICLE_LABEL': 'public-build-A'}

def write(name, data):
    (OUT / name).write_text(json.dumps(data, indent=2) + '\n')
def command(args, cwd, log_name, env=ENV, check=True):
    result = subprocess.run(args, cwd=cwd, env=env, capture_output=True, text=True, timeout=240)
    log = '\n'.join(x.rstrip() for x in (result.stdout + result.stderr).splitlines()).rstrip() + '\n'
    (OUT / log_name).write_text(log)
    if check and result.returncode:
        raise RuntimeError(log)
    return result.returncode, log
def cli(*args):
    result = subprocess.run([*CLI, *args], cwd=PW, text=True, capture_output=True, timeout=90)
    if result.returncode:
        raise RuntimeError(result.stdout + result.stderr)
    return result.stdout.strip()
def evaluate(code):
    return json.loads(cli('--raw', 'eval', code))
def run_browser(code):
    return cli('run-code', 'async (page) => { ' + code + ' }')
def request(base, path, method='GET', headers=None):
    try:
        response = urllib.request.urlopen(urllib.request.Request(base + path, method=method, headers=headers or {}), timeout=10)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        return response.status, dict(response.headers), response.read()
def png_pattern():
    width, height = 1600, 1000
    raw = b''.join(b'\0' + bytes(value for x in range(width) for value in ((x // 8) % 256, (y // 5) % 256, ((x + y) // 13) % 256)) for y in range(height))
    def chunk(kind, data):
        return struct.pack('!I', len(data)) + kind + data + struct.pack('!I', zlib.crc32(kind + data))
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('!IIBBBBB', width, height, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b'')
def copy_app(target):
    shutil.copytree(APP, target, ignore=shutil.ignore_patterns('node_modules', '.next'))
    (target / 'node_modules').symlink_to(APP / 'node_modules', target_is_directory=True)
    (target / 'public').mkdir(exist_ok=True)
    png = png_pattern()
    for name in ['plain', 'fixed', 'responsive', 'lazy-plain', 'lazy-next']:
        (target / 'public' / (name + '.png')).write_bytes(png)
    (target / 'public/favicon.ico').write_bytes(b'')
    return {'width': 1600, 'height': 1000, 'bytes': len(png), 'sha256': hashlib.sha256(png).hexdigest()}

with tempfile.TemporaryDirectory(prefix='article-next-batch10-') as temporary:
    scratch = Path(temporary)
    app = scratch / 'positive'
    image_input = copy_app(app)
    original = (APP / 'cases/middleware.js').read_text()
    (app / 'middleware.js').write_text(original)
    code, _ = command(['node', str(APP / 'node_modules/@next/codemod/bin/next-codemod.js'), 'middleware-to-proxy', '.', '--force'], app, 'codemod.log')
    assert not (app / 'middleware.js').exists()
    migrated = (app / 'proxy.js').read_text()
    assert 'export function proxy(' in migrated and 'matcher:' in migrated
    write('proxy-codemod.json', {'version': '16.3.4', 'exit': code, 'before': original, 'after': migrated})
    command(['node', str(APP / 'node_modules/next/dist/bin/next'), 'build', '--webpack'], app, 'next-build.log')
    build_id = (app / '.next/BUILD_ID').read_text().strip()
    print('Positive production build passed', flush=True)
    env_results = []
    for label in ['B', 'C']:
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', 0))
            port = sock.getsockname()[1]
        base = f'http://127.0.0.1:{port}'
        runtime_env = {**ENV, 'ARTICLE_SERVER_LABEL': 'server-runtime-' + label, 'NEXT_PUBLIC_ARTICLE_LABEL': 'public-runtime-' + label}
        log_path = OUT / ('next-server-' + label + '.log')
        with log_path.open('w') as log:
            server = subprocess.Popen(['node', str(APP / 'node_modules/next/dist/bin/next'), 'start', '-H', '127.0.0.1', '-p', str(port)], cwd=app, env=runtime_env, stdout=log, stderr=subprocess.STDOUT)
            try:
                for _ in range(150):
                    if server.poll() is not None:
                        raise RuntimeError('Next server exited')
                    try:
                        status, _, _ = request(base, '/')
                        if status == 200:
                            break
                    except OSError:
                        pass
                    time.sleep(.1)
                else:
                    raise TimeoutError('Next readiness')
                cli('open', base)
                run_browser('await page.setViewportSize({width:1280,height:720});')
                observed = {'runtime': label, 'buildId': build_id}
                for kind in ['static', 'dynamic']:
                    status, _, body = request(base, '/env/' + kind)
                    assert status == 200
                    text = re.search(rb'<pre id="env-result">(.*?)</pre>', body).group(1).decode()
                    observed[kind] = json.loads(html.unescape(text))
                assert observed['static'] == {'server': 'server-build-A', 'public': 'public-build-A'}
                assert observed['dynamic'] == {'server': 'server-runtime-' + label, 'public': 'public-build-A'}
                cli('goto', base + '/env/client')
                run_browser('await page.waitForFunction(() => document.getElementById("env-result").textContent !== "null");')
                observed['client'] = evaluate('() => JSON.parse(document.getElementById("env-result").textContent)')
                env_results.append(observed)
                write('next-env-results.json', env_results)
                assert observed['client'] == {'direct': 'public-build-A', 'dynamic': None, 'alias': 'public-build-A', 'server': None}, observed
                if label == 'B':
                    _, _, client_html = request(base, '/env/client')
                    scripts = sorted(set(html.unescape(x.decode()) for x in re.findall(rb'<script[^>]+src="([^"]+)"', client_html)))
                    evidence = []
                    for path in scripts:
                        _, _, data = request(base, path)
                        position = data.find(b'public-build-A')
                        if position >= 0:
                            evidence.append({'path': path, 'sha256': hashlib.sha256(data).hexdigest(), 'excerpt': data[max(0, position-120):position+650].decode()})
                    assert evidence
                    write('client-bundle-evidence.json', evidence)
                if label == 'C':
                    continue
                proxies = []
                for path, method in [('/protected', 'GET'), ('/protected/a/b', 'GET'), ('/protected?x=1', 'GET'), ('/protectedness', 'GET'), ('/', 'GET'), ('/plain.png', 'GET'), ('/protected', 'POST')]:
                    status, headers, _ = request(base, path, method)
                    header = next((v for k, v in headers.items() if k.lower() == 'x-article-proxy'), None)
                    should_match = path.split('?')[0] == '/protected' or path.startswith('/protected/')
                    assert bool(header) == should_match
                    proxies.append({'path': path, 'method': method, 'status': status, 'proxyHeader': header})
                write('proxy-http-results.json', proxies)
                runtimes = {}
                for runtime in ['node', 'edge', 'file', 'eval']:
                    status, _, body = request(base, '/runtime/' + runtime + '?text=fixture')
                    assert status == 200, (runtime, status, body)
                    runtimes[runtime] = json.loads(body)
                assert runtimes['node'] == runtimes['edge'] == {'text': 'fixture', 'bytes': 7, 'sha256': hashlib.sha256(b'fixture').hexdigest()}
                assert runtimes['file'] == {'text': 'local fixture only'} and runtimes['eval'] == {'value': 3}
                write('runtime-http-results.json', runtimes)
                cli('goto', base + '/images')
                run_browser('await page.waitForFunction(() => ["plain","fixed","responsive"].every(id => { const img=document.getElementById(id); return img.complete && img.naturalWidth > 0; }));')
                def image_state():
                    return evaluate('() => ({viewport:innerWidth,dpr:devicePixelRatio,images:[...document.images].map(img=>({id:img.id,src:img.getAttribute("src"),srcset:img.getAttribute("srcset"),sizes:img.getAttribute("sizes"),loading:img.getAttribute("loading"),currentSrc:img.currentSrc,renderedWidth:img.getBoundingClientRect().width,naturalWidth:img.naturalWidth,complete:img.complete})),resources:performance.getEntriesByType("resource").filter(x=>x.initiatorType==="img").map(x=>({name:x.name,transferSize:x.transferSize,encodedBodySize:x.encodedBodySize}))})')
                before = image_state()
                assert before['dpr'] == 1 and before['viewport'] == 1280
                assert all(img['naturalWidth'] == 0 for img in before['images'] if img['id'].startswith('lazy-'))
                run_browser('await page.locator("#lazy-pair").scrollIntoViewIfNeeded(); await page.waitForFunction(() => ["lazy-plain","lazy-next"].every(id => document.getElementById(id).naturalWidth > 0));')
                after = image_state()
                images = {'input': image_input, 'beforeScroll': before, 'afterScroll': after, 'responses': []}
                for img in after['images']:
                    url = img['currentSrc']
                    assert url.startswith(base)
                    status, headers, data = request(base, url[len(base):], headers={'Accept': 'image/avif,image/webp,image/*,*/*;q=0.8'})
                    assert status == 200
                    images['responses'].append({'id': img['id'], 'status': status, 'contentType': headers.get('Content-Type', headers.get('content-type')), 'bodyBytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
                write('image-results.json', images)
                environment = json.loads(subprocess.check_output(['node', '-e', 'console.log(JSON.stringify(Object.fromEntries(["next","react","react-dom","@next/codemod"].map(x=>[x,require(x+"/package.json").version]))))'], cwd=app, text=True))
                write('next-environment.json', {'versions': environment, 'node': subprocess.check_output(['node','--version'], text=True).strip(), 'browser': evaluate('navigator.userAgent'), 'build': 'production webpack', 'cacheComponents': False, 'reactCompiler': False, 'scope': 'loopback next start, synthetic values and images, no cloud deployment'})
                print('HTTP, runtime, image, and environment B probes passed', flush=True)
            finally:
                cli('close')
                server.terminate()
                server.wait(timeout=15)
        log_path.write_text('\n'.join(x.rstrip() for x in log_path.read_text().splitlines()).rstrip() + '\n')
    assert len({x['buildId'] for x in env_results}) == 1
    print('Same build under environment C passed', flush=True)
    negatives = []
    for name in ['proxy-runtime', 'edge-file', 'edge-eval']:
        negative = scratch / name
        copy_app(negative)
        if name == 'proxy-runtime':
            source = migrated + "\nexport const runtime = 'edge';\n"
            (negative / 'proxy.js').write_text(source)
        else:
            source = (APP / 'cases' / (name + '.js')).read_text()
            target = negative / 'app/runtime/negative/route.js'
            target.parent.mkdir(parents=True)
            target.write_text(source)
        code, log = command(['node', str(APP / 'node_modules/next/dist/bin/next'), 'build', '--webpack'], negative, name + '-build.log', check=False)
        result = {'name': name, 'exit': code, 'source': source, 'log': name + '-build.log'}
        if name == 'edge-eval':
            assert code == 0, log
            with socket.socket() as sock:
                sock.bind(('127.0.0.1', 0)); port = sock.getsockname()[1]
            base = f'http://127.0.0.1:{port}'
            runtime_log = OUT / 'edge-eval-server.log'
            with runtime_log.open('w') as output:
                server = subprocess.Popen(['node', str(APP / 'node_modules/next/dist/bin/next'), 'start', '-H', '127.0.0.1', '-p', str(port)], cwd=negative, env=ENV, stdout=output, stderr=subprocess.STDOUT)
                try:
                    for _ in range(150):
                        if server.poll() is not None: raise RuntimeError('Edge eval server exited')
                        try:
                            if request(base, '/')[0] == 200: break
                        except OSError: pass
                        time.sleep(.1)
                    else: raise TimeoutError('Edge eval readiness')
                    status, _, body = request(base, '/runtime/negative')
                    result.update(runtimeStatus=status, response=body.decode()[:2000], serverLog='edge-eval-server.log')
                    assert status in [200, 500]
                finally:
                    server.terminate(); server.wait(timeout=15)
            runtime_log.write_text('\n'.join(x.rstrip() for x in runtime_log.read_text().splitlines()).rstrip() + '\n')
        else:
            assert code != 0, (name, log)
        negatives.append(result)
        write('negative-build-results.json', negatives)
        print('Runtime restriction case:', name, result['exit'], result.get('runtimeStatus'), flush=True)
    print('Next batch 10 experiments passed', flush=True)
