"""Compare article examples and reported measurements to the executed evidence."""
import hashlib,json,pathlib,re,subprocess
ROOT=pathlib.Path(__file__).resolve().parents[2]
OUT=ROOT/'production/2026-09/batch-06'
catalog=json.loads((ROOT/'production/2026-09/catalog.json').read_text())
items=[x for x in catalog if x.get('batch')==6]
assert len(items)==6
read=lambda p:(ROOT/p).read_text()
bench=read('experiments/article-stock-2026-09/react-memoization-bench.tsx')
estimator=read('experiments/article-stock-2026-09/plane-estimate-audit.py')
code_checks=[]
for item in items:
 for lang in ['japanese','english']:
  text=read(item[lang])
  for language,code in re.findall(r'^```(tsx|python)\n(.*?)^```',text,re.M|re.S):
   target=bench if language=='tsx' else estimator
   assert code.strip() in target,(item['id'],lang)
   code_checks.append({'id':item['id'],'language':lang,'kind':language,'matchesExecutedSource':True})
  assert not re.search(r'\b(?:I|my|me)\b',text) if lang=='english' else True
timings={}
for group in ['cheap','summary','callback']:
 result=json.loads((OUT/f'react-{group}.json').read_text())
 outputs={x['output'] for values in result['results'].values() for x in values}
 assert len(outputs)==1
 if group=='cheap':assert outputs=={'43'*2000}
 for name,values in result['results'].items():
  assert len(values)==9
  assert len({(x['calculations'],x['children']) for x in values})==1
  timings[group+'/'+name]=f"{result['summary'][name]['medianMs']:.1f}ms"
 for item in [x for x in items if x['id']=='T14']:
  for lang in ['japanese','english']:
   text=read(item[lang])
   for name,v in result['summary'].items():assert f"{v['medianMs']:.1f}ms" in text
   assert '152.0.0.0' in text
   assert '29.1' in text and '33.4' in text and '32.9' in text and '39.5' in text
estimate=json.loads((OUT/'estimate-audit.json').read_text())
assert estimate['totalOpen']=={'count':22,'points':148}
assert len(estimate['refusalChecks'])==4
for x in [x for x in items if x['id']=='P19']:
 for lang in ['japanese','english']:
  text=read(x[lang]); assert '| 22 | 148 | 0 |' in text and '| 6 | 48 | 0 |' in text
  assert '| 11 |' in text and '| 24 |' in text
audit=json.loads((OUT/'humanizer-audit.json').read_text())
assert len(audit['files'])==12
for x in audit['files']:
 assert hashlib.sha256((ROOT/x['path']).read_bytes()).hexdigest()==x['after_sha256']
baseline='8a1bfa8'; prior='3956586fc1aa0dc3f61b5e137827fd2d77de95d5'
def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT)
def identical(rev,folders,exclude=()):
 paths=[p for p in git('ls-tree','-r','--name-only',rev,*folders).decode().splitlines() if p not in exclude]
 for path in paths:assert git('show',rev+':'+path)==(ROOT/path).read_bytes(),path
 return len(paths)
guard={'baseline':baseline,'priorBatchHead':prior,
 'baselineProtectedFiles':{'count':identical(baseline,[],['ARTICLE_IDEAS_2026-09.md']),'excluded':['ARTICLE_IDEAS_2026-09.md'],'byteIdentical':True},
 'priorArticleFiles':{'count':identical(prior,['articles','public','devto']),'byteIdentical':True},
 'humanizerFinalHashes':{'count':12,'allMatch':True}}
(OUT/'repository-guard.json').write_text(json.dumps(guard,indent=2)+'\n')
result={'checks':code_checks,'timingMedians':timings,'fullDOMOutputEqualAcrossEveryRound':True,'estimateSnapshotAndRefusalChecks':True,'finalHumanizerHashesMatch':True,'notes':'Final measurements use full DOM text checks; first-run evidence only checked cheap-output length and prefix and is retained separately.'}
(OUT/'snippet-verification.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({'sourceCodeBlocks':len(code_checks),'timingCases':len(timings),'guard':guard},ensure_ascii=False))
