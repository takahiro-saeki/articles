import json,pathlib,subprocess
ROOT=pathlib.Path(__file__).resolve().parents[2]
OUT=ROOT/'production/2026-09/batch-15'
PW=ROOT/'output/playwright/batch15-cache';PW.mkdir(parents=True,exist_ok=True)
CLI=['bash','/Users/takahiro_saeki/.codex/skills/playwright/scripts/playwright_cli.sh','-s=article-cache-batch15']
def cli(*args):
    r=subprocess.run([*CLI,*args],cwd=PW,text=True,capture_output=True,timeout=90)
    assert r.returncode==0,r.stdout+r.stderr
    return r.stdout
def evaluate(code):return json.loads(cli('--raw','eval',code))
try:
    opened=cli('open','http://127.0.0.1:9916/')
    (OUT/'cache-browser-cli.txt').write_text(opened)
    observed=evaluate('''async () => {
      const cases=[];
      async function inspect(url) {
        const stats=await (await fetch('/inspect',{cache:'no-store'})).json();
        return stats.counts[url];
      }
      for(const mode of ['none','worker','browser','both']) {
        const url=location.origin+'/data?mode='+mode+'&run=browser-'+Date.now();
        const replies=[];
        for(let i=0;i<2;i++) {
          const response=await fetch(url);
          replies.push({body:await response.text(),cacheControl:response.headers.get('cache-control')});
        }
        const afterTwo=await inspect(url);
        const purge=await (await fetch('/purge?target='+encodeURIComponent(url),{cache:'no-store'})).json();
        const afterPurgeReply=await (await fetch(url)).text();
        const afterPurge=await inspect(url);
        const reloadReply=await (await fetch(url,{cache:'reload'})).text();
        const afterReload=await inspect(url);
        cases.push({mode,replies,afterTwo,purge,afterPurgeReply,afterPurge,reloadReply,afterReload});
      }
      const cache=await caches.open('article-b15-storage-only');
      const url=location.origin+'/storage-only';
      await cache.put(url,new Response('explicit-cache-storage',{headers:{'Cache-Control':'no-store'}}));
      const stored=await (await cache.match(url)).text();
      const network=await (await fetch(url,{cache:'no-store'})).text();
      await caches.delete('article-b15-storage-only');
      return {browser:navigator.userAgent,cases,cacheStorage:{stored,networkWasDifferent:network!==stored,noServiceWorker:navigator.serviceWorker.controller===null},resourceEntries:performance.getEntriesByType('resource').filter(e=>e.name.includes('/data?')).map(e=>({name:e.name,transferSize:e.transferSize,encodedBodySize:e.encodedBodySize}))};
    }''')
    none,worker,browser,both=observed['cases']
    assert none['afterTwo']=={'visits':2,'sources':2}
    assert worker['afterTwo']=={'visits':2,'sources':1}
    assert browser['afterTwo']=={'visits':1,'sources':1}
    assert both['afterTwo']=={'visits':1,'sources':1}
    assert worker['purge']=={'deleted':True} and worker['afterPurge']=={'visits':3,'sources':2}
    assert browser['purge']=={'deleted':False} and browser['afterPurge']=={'visits':1,'sources':1}
    assert both['purge']=={'deleted':True} and both['afterPurge']=={'visits':1,'sources':1}
    assert both['afterReload']=={'visits':2,'sources':2} and both['reloadReply']=='generation-2'
    assert observed['cacheStorage']=={'stored':'explicit-cache-storage','networkWasDifferent':True,'noServiceWorker':True}
    observed['scope']='Loopback workerd cache and real Chromium HTTP cache/CacheStorage; no Cloudflare PoP, tiered cache, deployment or remote request.'
    (OUT/'cache-browser-experiment.json').write_text(json.dumps(observed,indent=2)+'\n')
    print(json.dumps({'browser':observed['browser'],'countsAfterTwo':{x['mode']:x['afterTwo'] for x in observed['cases']},'workerPurgeLeftBrowserCopy':True,'cacheStorageIndependent':True},indent=2))
finally:
    cli('close')
