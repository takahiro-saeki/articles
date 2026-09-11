"""Reconstruct draft inventory and a handoff from a fixed committed snapshot."""
from collections import Counter
from copy import deepcopy
import hashlib,json,re,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'production/2026-09/batch-12'
REF='6fe464919b7fba46d27395668d39d1e44b7f6964'
def git(*args): return subprocess.check_output(['git',*args],cwd=ROOT)
def source(path): return git('show',REF+':'+path)
catalog=json.loads(source('production/2026-09/catalog.json'))
schedule=json.loads(source('schedule/publishing-schedule.json'))
body=[x for x in catalog if x['status']=='完成' or '本文・日英・Humanizer検証済み' in x['verification']]
complete=[x for x in catalog if x['status']=='完成']
pending=[x for x in body if x['status']!='完成']
for row in body:
    for key in ['japanese','english']: assert source(row[key])
assert len(catalog)==90 and len(body)==68 and len(complete)==41 and len(pending)==27
assert not any(s['source'] in {x['japanese'] for x in catalog} for s in schedule)
assert all(x['platform']=='Zenn' for x in complete)
def covered_days(available, plan):
    remaining=available.copy(); days=0
    for needs in plan:
        if any(remaining.get(platform,0)<count for platform,count in needs.items()): break
        for platform,count in needs.items(): remaining[platform]-=count
        days+=1
    return days
available={'Zenn':len(complete),'Qiita':0}
fixtures=[('one Zenn pair daily',[{'Zenn':1}]*50,41),('two Zenn pairs daily',[{'Zenn':2}]*50,20),('Qiita slot first',[{'Qiita':1},{'Zenn':1}]*25,0),('Zenn slot first',[{'Zenn':1},{'Qiita':1}]*25,1)]
capacity=[]
for name,plan,expected in fixtures:
    observed=covered_days(available,plan);assert observed==expected
    capacity.append({'case':name,'days':observed,'planPreview':plan[:2],'assumption':'hypothetical allocation; no schedule written'})
status=source('ARTICLE_PRODUCTION_STATUS_2026-09.md').decode()
assert '完成 41/90' in status and '68/90' in status and '22件' in status
snapshot={'ref':REF,'candidateCount':90,'bodyVerifiedPairs':68,'completePairs':41,'canonicalPendingPairs':27,'remainingBodies':22,'articleFilesForBodyPairs':len(body)*2,'readyByPlatform':available,'scheduleRows':len(schedule),'scheduleMin':min(x['date'] for x in schedule),'scheduleMax':max(x['date'] for x in schedule),'futureScheduleRowsFrom20260911':sum(x['date']>='2026-09-11' for x in schedule),'capacityExamples':capacity}
(OUT/'stock-analysis.json').write_text(json.dumps(snapshot,ensure_ascii=False,indent=2)+'\n')
# This is a new proposed handoff format, validated against the old committed work.
evidence_paths=['production/2026-09/catalog.json','ARTICLE_PRODUCTION_STATUS_2026-09.md','production/2026-09/batch-11/review.md','production/2026-09/batch-11/humanizer-audit.json','production/2026-09/batch-11/content-validation.json','production/2026-09/batch-11/canonical-gate.json']
manifest={'revision':REF,'branch':'codex/article-stock-2026-09','counts':{k:snapshot[k] for k in ['bodyVerifiedPairs','completePairs','canonicalPendingPairs','remainingBodies']},'evidence':{path:hashlib.sha256(source(path)).hexdigest() for path in evidence_paths},'nextCandidates':['P04','P09','P16','P18'],'unresolved':'Qiita IDs and canonical URLs; do not fabricate or publish to allocate IDs','resumeAction':'Check current Git status and compare these sources before selecting an unstarted batch'}
def verify_handoff(value,read):
    errors=[]
    if value['revision']!=REF: errors.append('revision mismatch')
    if value['counts']!=manifest['counts']: errors.append('count mismatch')
    for path,digest in value['evidence'].items():
        try: data=read(path)
        except FileNotFoundError: errors.append('missing evidence: '+path);continue
        if hashlib.sha256(data).hexdigest()!=digest:errors.append('changed evidence: '+path)
    return errors
assert verify_handoff(manifest,source)==[]
checks=[{'case':'fixed snapshot matches','errors':[]}]
x=deepcopy(manifest);x['revision']='old-revision';checks.append({'case':'different revision','errors':verify_handoff(x,source)})
x=deepcopy(manifest);x['counts']['completePairs']=68;checks.append({'case':'body count mislabeled complete','errors':verify_handoff(x,source)})
missing=evidence_paths[-1]
def read_missing(path):
    if path==missing: raise FileNotFoundError(path)
    return source(path)
checks.append({'case':'canonical gate evidence missing','errors':verify_handoff(manifest,read_missing)})
checks.append({'case':'evidence content changed','errors':verify_handoff(manifest,lambda path:source(path)+(b' changed' if path==missing else b''))})
assert all(x['errors'] for x in checks[1:])
(OUT/'handoff-example.json').write_text(json.dumps({'status':'new local proposal, not an existing Codex feature',**manifest},ensure_ascii=False,indent=2)+'\n')
(OUT/'handoff-verification.json').write_text(json.dumps({'checks':checks,'limitation':'hash agreement proves snapshot identity, not semantic correctness or current live job state'},ensure_ascii=False,indent=2)+'\n')
print(json.dumps(snapshot,ensure_ascii=False,indent=2));print('handoff cases:',len(checks))
