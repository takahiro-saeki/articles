"""Read public AASA endpoints. Running again replaces the observations; review changed data."""
import datetime,hashlib,json,pathlib,subprocess,tempfile,urllib.error,urllib.request
OUT=pathlib.Path('production/2026-09/batch-14')
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args):return None
def capture_origins():
    opener=urllib.request.build_opener(NoRedirect());results=[]
    for domain in ['squad-note.com','dev.squad-note.com']:
        url='https://'+domain+'/.well-known/apple-app-site-association'
        try:r=opener.open(urllib.request.Request(url,headers={'User-Agent':'article-aasa-audit/1.0'}),timeout=20)
        except urllib.error.HTTPError as e:r=e
        data=r.read();item={'url':url,'status':r.status,'headers':{k:v for k,v in r.headers.items() if k.lower() in ['content-type','cache-control','location','age','date','etag']},'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data)}
        try:item['body']=json.loads(data)
        except ValueError:item['body_is_json']=False
        results.append(item)
    output={'checked_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'method':'GET, redirects disabled, no authentication, one user agent per host','results':results}
    (OUT/'aasa-http-observations.json').write_text(json.dumps(output,ensure_ascii=False,indent=2)+'\n')
def run_printed_curl():
    article=pathlib.Path('public/universal-links-aasa-diagnostics.md').read_text()
    import re,shlex
    command=re.search(r'^```sh\n([\s\S]*?)^```',article,re.M)[1]
    args=shlex.split(command.replace('\\\n',''))
    assert args==['curl','--silent','--show-error','--dump-header','aasa.headers','--output','aasa.json','https://squad-note.com/.well-known/apple-app-site-association']
    with tempfile.TemporaryDirectory(prefix='article-aasa-curl-') as td:
        subprocess.run(args,cwd=td,check=True,timeout=30)
        body=(pathlib.Path(td)/'aasa.json').read_bytes();headers=(pathlib.Path(td)/'aasa.headers').read_text()
    assert re.search(r'^HTTP/\S+ 200',headers,re.M) and 'application/json' in headers.lower()
    output={'checked_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'command':args,'curl_version':subprocess.check_output(['curl','--version'],text=True).splitlines()[0],'headers':headers,'body':json.loads(body),'bytes':len(body),'sha256':hashlib.sha256(body).hexdigest()}
    (OUT/'aasa-curl-observation.json').write_text(json.dumps(output,ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':
    import sys
    if '--curl-only' not in sys.argv:capture_origins()
    run_printed_curl()
    print('Read-only AASA capture complete; no redirect following or credentials.')
