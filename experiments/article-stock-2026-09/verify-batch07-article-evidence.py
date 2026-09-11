"""Match the published-draft claims and snippets to the completed experiment records."""
import hashlib,json,pathlib,re,subprocess
ROOT=pathlib.Path(__file__).resolve().parents[2]
OUT=ROOT/'production/2026-09/batch-07'
EXP=pathlib.Path(__file__).parent
def read(name): return json.loads((OUT/name).read_text())
def sha(b):return hashlib.sha256(b).hexdigest()
catalog=json.loads((ROOT/'production/2026-09/catalog.json').read_text())
items=[x for x in catalog if x['batch']==7]
assert len(items)==6
articles={x['id']:{lang:(ROOT/x[path]).read_text() for lang,path in [('ja','japanese'),('en','english')]} for x in items}
source_map={
 'T18':[EXP/'suspense-boundary-bench.tsx']*2,
 'T19':[EXP/'next-batch07/app/bundle/leaves/page.jsx',EXP/'next-batch07/app/bundle/slot/page.jsx'],
 'T21':[EXP/'next-batch07/lib/probe.js',EXP/'next-batch07/app/cache/memo/page.jsx'],
}
checked=[]
for id,paths in source_map.items():
    for lang,body in articles[id].items():
        snippets=re.findall(r'^```(?:tsx|jsx|js)\n(.*?)^```',body,re.M|re.S)
        assert len(snippets)==len(paths)
        for snippet,path in zip(snippets,paths):
            assert snippet.strip() in path.read_text(),(id,lang,path)
    checked.append({'id':id,'blocks':len(paths),'match':'exact executed source'})
for lang,body in articles['O25'].items():
    snippet=re.findall(r'^```python\n(.*?)^```',body,re.M|re.S)
    assert len(snippet)==1
    namespace={};exec(compile(snippet[0],'O25 article','exec'),namespace)
    assert namespace['segments']==read('lt-source-audit.json')['proposedSegmentsSeconds']
    assert namespace['buffer']==30
checked.append({'id':'O25','blocks':1,'match':'article code executed, compared to proposal record'})

bundles=read('next-bundle.json')
assert bundles['broad']['dom']==bundles['leaves']['dom']==bundles['slot']['dom']
assert len(bundles['broad']['dom']['catalog'])==256
assert bundles['broad']['jsBytes']-bundles['leaves']['jsBytes']==22883
assert bundles['leaves']['jsBytes']-bundles['slot']['jsBytes']==55
for variant,values in bundles.items():
    assert values['interaction']==['A: 1','B: 1']
    for key in ['jsBytes','jsGzipBytes','htmlBytes','htmlGzipBytes']:
        for text in articles['T19'].values(): assert f'{values[key]:,}' in text
    assert any(x['hasCatalogMarker'] for x in values['assets'])==(variant=='broad')

cache=read('next-cache.json')
assert cache['buildOriginCounts']=={'full':1}
for key,increase in [('memo',3),('data',1),('full',0)]:
    r=cache['requests'][key]
    assert r['after']-r['before']==increase
    assert len(r['responses'])==3
    if key=='full':assert all(x['headers']['x-nextjs-cache']=='HIT' for x in r['responses'])
    else:assert all('x-nextjs-cache' not in x['headers'] for x in r['responses'])
assert [r['originCount'] for r in cache['router']]==[1,1,2,3]
env=read('next-environment.json')
assert env['versions']=={'next':'16.3.4','react':'19.2.5','react-dom':'19.2.5'}
assert env['cacheComponents'] is False
assert env['bundledReact']=='19.3.0-canary-cbb046ab-20260731'
for id in ['T19','T21']:
    for body in articles[id].values(): assert env['bundledReact'] in body

suspense=read('suspense-results.json')
assert len(suspense['records'])==5
for r in suspense['records']:
    mode=r['mode'];stable_transition='transition' in mode and not mode.endswith('-key')
    assert r['initial']['shell']==mode.startswith('narrow')
    assert r['suspended']['fallback']==(not stable_transition)
    assert r['suspended']['result']==('Result 0' if stable_transition else None)
    assert r['suspended']['shell']==(mode!='broad-urgent')
    assert r['resolved']=={'shell':True,'fallback':False,'result':'Result 1','pending':'idle','input':'typed'}

plane=read('plane-restore-cli.json')
assert len(plane['cases'])==4
assert all(x['exitCode']==0 and x['successMessage'] for x in plane['cases'])
assert [len(x['attempts']) for x in plane['cases']]==[4,3,3,4]
assert len(read('plane-compose-inventory.json')['services'])==13
expo=read('expo-error-recovery.json')
assert len(expo['cases'])==7 and all(x['passed'] for x in expo['cases'])
assert all(x['actions']==x['expected'] for x in expo['cases'])
previous=next(x for x in expo['cases'] if x['case']=='prior-success-new-ready')
assert any('launching a new update' in x for x in previous['pipelineLogs'])
now=next(x for x in expo['cases'] if x['case']=='content-appeared-new-ready')
assert now['actions']==['markSuccessful','crash']

audit=read('humanizer-audit.json')
assert len(audit['files'])==12
for entry in audit['files']:
    assert sha((ROOT/entry['path']).read_bytes())==entry['after_sha256'],entry['path']
    assert entry['frontmatter_code_links_numeric_tokens_unchanged']

def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT)
def tree(ref,*paths):return git('ls-tree','-r','--name-only',ref,*paths).decode().splitlines()
baseline=[p for p in tree('8a1bfa8') if p!='ARTICLE_IDEAS_2026-09.md']
for path in baseline: assert (ROOT/path).read_bytes()==git('show','8a1bfa8:'+path),path
prior_articles=[p for p in tree('d9911bf','articles','public','devto') if p.endswith('.md')]
for path in prior_articles: assert (ROOT/path).read_bytes()==git('show','d9911bf:'+path),path
guard={'baselineFilesUnchanged':len(baseline),'previousArticleFilesUnchanged':len(prior_articles),'humanizerFinalHashesMatched':12,'baseline':'8a1bfa8','beforeBatch':'d9911bf','exception':'ARTICLE_IDEAS_2026-09.md production progress section'}
(OUT/'repository-guard.json').write_text(json.dumps(guard,indent=2)+'\n')
report={'articleSnippets':checked,'suspenseCases':5,'nextBundleVariants':3,'nextCacheHTTPResponses':9,'nextRouterSteps':4,'planeCLICases':4,'expoSwiftCases':7,'guard':guard}
(OUT/'snippet-verification.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
