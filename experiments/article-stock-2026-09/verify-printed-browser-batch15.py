import pathlib,json,re,subprocess
ROOT=pathlib.Path(__file__).resolve().parents[2]
OUT=ROOT/'production/2026-09/batch-15'
PW=ROOT/'output/playwright/batch15-cache';PW.mkdir(parents=True,exist_ok=True)
CLI=['bash','/Users/takahiro_saeki/.codex/skills/playwright/scripts/playwright_cli.sh','-s=article-printed-batch15']
def cli(*args):
 r=subprocess.run([*CLI,*args],cwd=PW,capture_output=True,text=True,timeout=90);assert r.returncode==0,r.stdout+r.stderr;return r.stdout
code=re.findall(r'^```js\n([\s\S]*?)^```',(ROOT/'public/cloudflare-cache-api-browser-cache.md').read_text(),re.M)[0]
try:
 cli('open','http://127.0.0.1:9916/')
 wrapper='async () => { const records=[]; const console={log:value=>records.push(value)}; '+code+';return records;}'
 result=json.loads(cli('--raw','eval',wrapper))
 assert result==[{'first':'generation-1','second':'generation-1','counts':{'visits':1,'sources':1}}],result
 (OUT/'printed-browser-experiment.json').write_text(json.dumps({'printedCode':code,'results':result,'realBrowser':True,'cacheDisabled':False,'requestsIntercepted':False},indent=2)+'\n')
 print(json.dumps(result))
finally:cli('close')
