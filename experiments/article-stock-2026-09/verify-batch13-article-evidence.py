import hashlib,json,math,pathlib,re,subprocess,tempfile
ROOT=pathlib.Path(__file__).resolve().parents[2]
OUT=ROOT/'production/2026-09/batch-13'
read=lambda name:json.loads((OUT/name).read_text())
sha=lambda data:hashlib.sha256(data).hexdigest()
git=lambda *args:subprocess.check_output(['git',*args],cwd=ROOT)
catalog=json.loads((ROOT/'production/2026-09/catalog.json').read_text())
selected=[x for x in catalog if x.get('batch')==13]
assert len(selected)==6
texts={x['id']:(ROOT/x['japanese']).read_text() for x in selected}
def blocks(text,language):return re.findall(r'^```'+language+r'\n([\s\S]*?)^```',text,re.M)
for x in selected:
    assert re.findall(r'^```[^\n]*\n([\s\S]*?)^```',(ROOT/x['japanese']).read_text(),re.M)==re.findall(r'^```[^\n]*\n([\s\S]*?)^```',(ROOT/x['english']).read_text(),re.M)
def node(code,cwd=ROOT):return subprocess.check_output(['node','--input-type=module','-e',code],cwd=cwd,text=True)
state=blocks(texts['P04'],'js')[0]
assert "[ 'Done' ]" in node(state)
mutation=state.replace('name: "Ready for verification", group: "started"','name: "Ready for verification", group: "completed"')
assert "[ 'Ready for verification', 'Done' ]" in node(mutation)
module_example=json.loads(blocks(texts['P09'],'json')[0]);assert module_example['verification_result']=='not_run'
assert all(module_example['verification_target'][k] is None for k in ['build_number','artifact_reference','source_commit'])
for heading in ['Purpose','Repository','Scope','Acceptance criteria','Verification plan','Current evidence','Stop point','Out of scope']:assert heading in blocks(texts['P16'],'text')[0]
for heading in ['Decision','Reason','Preserved evidence','Remaining effects','Reconsider when','Archive scope']:assert heading in blocks(texts['P18'],'text')[0]
sources=read('repository-sources.json')
for s in sources['sources']:
    data=subprocess.check_output(['git','-C',str(ROOT.parent/s['repo']),'show',s['commit']+':'+s['path']]);assert sha(data)==s['sha256']
assert sources['version_fields']=={'version':'1.0.11','ios_build_number':'2','android_version_code':1,'eas_version_source':'remote','production_auto_increment':True}
assert sources['ticket_evidence']['web_checked'] and sources['ticket_evidence']['mobile_unchecked']
schedule=read('schedule-experiment.json');assert len(schedule['checks'])==8
assert schedule['checks'][1]['observed']=={'schedules':2,'errors':0}
assert schedule['checks'][2]['observed']==['2026-09-10','2027-09-10']
assert schedule['checks'][-1]['observed']=={'after_failure':6,'after_retry':13,'distinct_dates':7,'real_database':False,'real_network':False}
parser_ref=next(s for s in sources['sources'] if s['path']=='packages/schedule-text-parser/src/index.ts')
parser=subprocess.check_output(['git','-C',str(ROOT.parent/parser_ref['repo']),'show',parser_ref['commit']+':'+parser_ref['path']])
with tempfile.TemporaryDirectory(prefix='article-b13-snippet-') as td:
    p=pathlib.Path(td);(p/'package.json').write_text('{"type":"module"}')
    (p/'schedule-text-parser.ts').write_bytes(parser)
    (p/'check.mjs').write_text(blocks(texts['O23'],'js')[0])
    stdout=subprocess.check_output(['node','check.mjs'],cwd=p,text=True)
    assert stdout==blocks(texts['O23'],'text')[0]
audio=read('audio-browser-experiment.json');a,b,c,d=audio['cases']
assert a['rms']==0 and a['maximum_byte']==0
assert abs(b['rms']-.25/math.sqrt(2))<1e-7 and abs(c['rms']-.5/math.sqrt(2))<1e-7
assert [b['peak_bin'],c['peak_bin'],d['peak_bin']]==[20,20,22]
assert [b['maximum_byte'],c['maximum_byte'],d['maximum_byte']]==[211,232,232]
assert d['peak_bin_hz']==473.73046875
for case in audio['cases']:
    if case['rms']:assert f"{case['rms']:.6f}" in texts['O24']
rms_code=blocks(texts['O24'],'js')[0]
rms_result=json.loads(node(rms_code+'\nconst samples=Float32Array.from({length:4096},(_,i)=>0.5*Math.sin(2*Math.PI*20*i/2048));console.log(JSON.stringify({rms:computeAmplitude(samples),silence:computeAmplitude(new Float32Array(4096)),empty:Number.isNaN(computeAmplitude(new Float32Array()))}));'))
assert abs(rms_result['rms']-c['rms'])<1e-7 and rms_result['silence']==0 and rms_result['empty']
assert node(blocks(texts['O24'],'js')[1])=='468.75\n473.73046875\n'
unit=read('audio-unit-experiment.json');assert set(unit['upper_bin_700_bands'].values())=={0}
assert unit['following_eight_calls']==[False]*8 and unit['beat_first_spike']
plane=read('plane-snapshot.json');assert len(plane['states'])==3
normalized=[[(s['name'],s['group'],s['default']) for s in p['states']] for p in plane['states']]
assert normalized[0]==normalized[1]==normalized[2]
assert len({s['id'] for p in plane['states'] for s in p['states']})==15
assert all(p['count']==5 and not p['next_page_results'] for p in plane['states'])
assert all(x['count']==0 and not x['next_page_results'] for x in plane['squadnote'].values())
assert len(plane['cancelled_query']['items'])==1 and plane['cancelled_query']['items'][0]['identifier']=='SQN-22'
assert plane['work_item']['group']=='started' and not plane['work_item']['repository_reference_in_description']
audit=read('humanizer-audit.json');assert len(audit['files'])==12
for x in audit['files']:
    assert sha((ROOT/x['path']).read_bytes())==x['after_sha256']
    assert x['frontmatter_code_links_numeric_tokens_unchanged']
base=[p for p in git('ls-tree','-r','--name-only','8a1bfa8').decode().splitlines() if p!='ARTICLE_IDEAS_2026-09.md']
for p in base:assert (ROOT/p).read_bytes()==git('show','8a1bfa8:'+p),p
prior=[p for p in git('ls-tree','-r','--name-only','246b3c7','articles','public','devto').decode().splitlines() if p.endswith('.md')]
for p in prior:assert (ROOT/p).read_bytes()==git('show','246b3c7:'+p),p
strip=lambda s:re.sub(r'\n<!-- production-progress:start -->[\s\S]*?<!-- production-progress:end -->\n?','',s)
assert strip((ROOT/'ARTICLE_IDEAS_2026-09.md').read_text())==git('show','8a1bfa8:ARTICLE_IDEAS_2026-09.md').decode()
guard={'baseline':'8a1bfa8','before_batch':'246b3c7','baseline_files_unchanged':len(base),'previous_article_files_unchanged':len(prior),'original_ideas_unchanged':True,'fixed_git_sources':len(sources['sources']),'final_humanizer_hashes':12}
(OUT/'repository-guard.json').write_text(json.dumps(guard,indent=2)+'\n')
report={'pairs':6,'executable_blocks':4,'static_json_blocks':1,'text_blocks':3,'state_classification_cases':2,'schedule_cases':8,'offline_audio_cases':4,'source_hashes':len(sources['sources']),'humanizer_prose_edits':sum(x['prose_edits'] for x in audit['files']),'guard':guard}
(OUT/'snippet-verification.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
