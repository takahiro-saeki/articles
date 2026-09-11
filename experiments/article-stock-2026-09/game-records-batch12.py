"""Verify retired files and execute the original dialogue exporter and catalog validator."""
import hashlib,json,re,subprocess,tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'production/2026-09/batch-12'
REPO=Path('/Users/takahiro_saeki/Documents/GitHub/game-jam-lab')
REF='f074703848586828b6a5acc0e465ccdd2c0d5244'
RETIRE='51984887e2b2be66c1330a3ade8d82a9392532b6'
BASE='events/2026-ai-browser-game-jam-4/'
def git(*args):return subprocess.check_output(['git','-C',str(REPO),*args])
def read(path,ref=REF):return git('show',ref+':'+BASE+path)
renames=[]
for line in git('diff-tree','-r','--name-status','-M',RETIRE+'^',RETIRE).decode().splitlines():
    cols=line.split('\t')
    if cols[0].startswith('R'):
        status,old,new=cols;assert status=='R100'
        before=git('show',RETIRE+'^:'+old);after=git('show',RETIRE+':'+new)
        assert before==after==git('show',REF+':'+new)
        renames.append({'old':old,'new':new,'sha256':hashlib.sha256(after).hexdigest(),'bytes':len(after)})
assert len(renames)==14 and sum(x['new'].endswith('.gd') for x in renames)==3
assert sum(x['new'].endswith(('.jpg','.png')) for x in renames)==4
assert sum(x['new'].endswith('.import') for x in renames)==4
assert sum(x['new'].endswith('.uid') for x in renames)==3
main=read('godot/main.gd').decode()
assert 'call_deferred("launch_project_charge")' in main
assert not any(x in main for x in ['capacitor_defense','zero_percent_city','chargeback'])
assert 'run/main_scene="res://main.tscn"' in read('godot/project.godot').decode()
assert 'The active event contains three polished vertical slices' in git('show',REF+':README.md').decode()
archive={'ref':REF,'retireCommit':RETIRE,'renamedFiles':len(renames),'gdScripts':3,'keyArtImages':4,'importSidecars':4,'uidSidecars':3,'byteIdenticalAtRenameAndRef':True,'renames':renames,'currentLauncher':'launch_project_charge only','staleRootReadme':True,'rebuiltArchivePrototypes':False,'measuredExportSize':False}
(OUT/'archive-analysis.json').write_text(json.dumps(archive,ensure_ascii=False,indent=2)+'\n')
paths=['tools/export-dialogue-review.mjs','godot/games/charge_clicker/story_catalog.gd','godot/games/charge_clicker/charge_clicker.gd']
source={path:read(path) for path in paths}
runner='''extends SceneTree
const Catalog = preload("res://godot/games/charge_clicker/story_catalog.gd")
func _init() -> void:
    assert(Catalog.validate().is_empty())
    var records = Catalog.EVENTS.duplicate(true)
    var file = FileAccess.open("res://catalog-runtime.json", FileAccess.WRITE)
    file.store_string(JSON.stringify(records))
    file.close()
    var original = Catalog.EVENTS.duplicate(true)
    Catalog.EVENTS.append(Catalog.EVENTS[0].duplicate(true))
    assert(Catalog.validate().size() == 1)
    Catalog.EVENTS = original.duplicate(true)
    Catalog.EVENTS[0]["lines"][0]["text_en"] = ""
    assert(Catalog.validate().size() == 1)
    Catalog.EVENTS = original.duplicate(true)
    Catalog.EVENTS[0]["title_en"] = ""
    assert(Catalog.validate().size() == 1)
    Catalog.EVENTS = original.duplicate(true)
    assert(Catalog.validate().is_empty())
    print("Catalog original and 3 mutations checked")
    quit(0)
'''
with tempfile.TemporaryDirectory(prefix='article-story-') as td:
    tmp=Path(td)
    for path,data in source.items():
        dest=tmp/path;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(data)
    (tmp/'docs').mkdir();(tmp/'project.godot').write_text('config_version=5\n');(tmp/'audit.gd').write_text(runner)
    def run(command):
        result=subprocess.run(command,cwd=tmp,capture_output=True,text=True,timeout=45)
        assert result.returncode==0 and 'SCRIPT ERROR' not in result.stderr,(result.stdout,result.stderr)
        return result
    run(['godot','--headless','--path',str(tmp),'--script','res://audit.gd'])
    records=json.loads((tmp/'catalog-runtime.json').read_text())
    assert len(records)==len({x['id'] for x in records})==33
    run(['node','tools/export-dialogue-review.mjs'])
    generated=(tmp/'docs/VOLT_NOMAD_TEXT_REVIEW.md').read_text()
    blocks=generated.split('## 戦闘中の短い通信')[0]
    def md(value):return str(value).replace('|','\\|').replace('\n','<br>')
    line_count=0
    for event in records:
        event_block=re.search(r'^### '+re.escape(event['id'])+r'\n(.*?)(?=^### |\Z)',blocks,re.M|re.S)
        assert event_block,event['id']
        event_block=event_block[1]
        assert len(re.findall(r'^\| \d+ \|',event_block,re.M))==len(event['lines'])
        for key,prefix in [('title_ja','日本語題'),('title_en','English title'),('context_ja','日本語状況'),('context_en','English context')]:
            assert f"- {prefix}: {event[key]}" in event_block
        for i,line in enumerate(event['lines'],1):
            expected='| '+str(i)+' | '+' | '.join(md(line[key]) for key in ['role','speaker_ja','speaker_en','text_ja','text_en'])+' |'
            assert expected in event_block,(event['id'],i)
            line_count+=1
    assert len(re.findall(r'^\| \d+ \|',blocks,re.M))==line_count
    combat_count=int(re.search(r'戦闘中の短い通信（(\d+)戦）',generated)[1])
    combat_rows=len(re.findall(r'^\| \d+ \|',generated.split('## 戦闘中の短い通信')[1],re.M))
    # A valid multiline GDScript call is outside this exporter's one-line regex.
    catpath=tmp/paths[1]; cat=catpath.read_text()
    needle='line("support", "支援演算 C6",';assert cat.count(needle)>0
    catpath.write_text(cat.replace(needle,'line("support",\n                "支援演算 C6",',1))
    run(['godot','--headless','--path',str(tmp),'--script','res://audit.gd'])
    assert json.loads((tmp/'catalog-runtime.json').read_text())==records
    run(['node','tools/export-dialogue-review.mjs'])
    mutated=(tmp/'docs/VOLT_NOMAD_TEXT_REVIEW.md').read_text().split('## 戦闘中の短い通信')[0]
    mutant_rows=len(re.findall(r'^\| \d+ \|',mutated,re.M));assert mutant_rows==line_count-1
    assert len(re.findall(r'^### ',mutated,re.M))==33
    report={'ref':REF,'godot':subprocess.check_output(['godot','--version'],text=True).strip(),'node':subprocess.check_output(['node','--version'],text=True).strip(),'storyEvents':33,'storyDialogueRows':line_count,'combatExchanges':combat_count,'combatDialogueRows':combat_rows,'allStoryMetadataAndFieldsMatchRuntime':True,'validatorMutations':3,'multilineMutation':{'godotDataUnchanged':True,'exportedRows':mutant_rows,'missingRows':1},'uiInspected':False,'entireGameRun':False,'releaseBuildExported':False,'sourceSha256':{path:hashlib.sha256(data).hexdigest() for path,data in source.items()}}
    (OUT/'story-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'archiveFiles':len(renames),**report},ensure_ascii=False,indent=2))
