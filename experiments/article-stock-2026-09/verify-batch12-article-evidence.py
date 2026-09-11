"""Verify printed snippets, tested claims, final prose hashes, and protected files."""
import ast,hashlib,json,re,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'production/2026-09/batch-12'
read=lambda p:json.loads((OUT/p).read_text())
sha=lambda b:hashlib.sha256(b).hexdigest()
catalog=json.loads((ROOT/'production/2026-09/catalog.json').read_text())
items=[x for x in catalog if x['batch']==12]
assert {x['id'] for x in items}=={'O02','O04','O06','O08','O11','O14'}
texts={x['id']:(ROOT/x['japanese']).read_text() for x in items}
blocks=lambda text,lang:re.findall(r'^```'+lang+r'\n(.*?)^```',text,re.M|re.S)
for x in items:
    en=(ROOT/x['english']).read_text()
    for lang in ['python','sh','yaml','text']:
        assert blocks(texts[x['id']],lang)==blocks(en,lang),x['id']
code=blocks(texts['O04'],'python');assert len(code)==1
original=(ROOT/'experiments/article-stock-2026-09/audit-production-batch12.py').read_text()
fn=next(n for n in ast.parse(original).body if isinstance(n,ast.FunctionDef) and n.name=='covered_days')
assert code[0].strip()==ast.get_source_segment(original,fn)
namespace={};exec(code[0],namespace);cover=namespace['covered_days']
assert cover({'Zenn':41,'Qiita':0},[{'Zenn':1}]*50)==41
assert cover({'Zenn':41,'Qiita':0},[{'Zenn':2}]*50)==20
assert cover({'Zenn':41,'Qiita':0},[{'Qiita':1},{'Zenn':1}]*25)==0
assert cover({'Zenn':41,'Qiita':0},[{'Zenn':1},{'Qiita':1}]*25)==1
assert blocks(texts['O06'],'sh')==[(OUT/'read-only-identity-check.sh').read_text()]
identity=read('identity-experiment.json');assert len(identity['results'])==6
assert [x['installedHook'] for x in identity['results']]==['no denial','deny','no denial','deny','no denial','no denial']
assert [x['proposedCheckExit'] for x in identity['results']]==[0,1,1,1,1,1]
assert sha(Path(identity['hookPath']).read_bytes())==identity['hookSha256']
canonical=read('canonical-experiment.json');assert canonical['cases']==6
assert canonical['results'][4]['calls'][0]['payload']['article']['canonical_url']=='null'
assert canonical['results'][2]['error']=='Qiita API 422: local fixture rejection'
stock=read('stock-analysis.json');assert [stock[k] for k in ['bodyVerifiedPairs','completePairs','canonicalPendingPairs','remainingBodies']]==[68,41,27,22]
assert stock['futureScheduleRowsFrom20260911']==0
handoff=read('handoff-verification.json');assert len(handoff['checks'])==5
assert handoff['checks'][0]['errors']==[] and all(x['errors'] for x in handoff['checks'][1:])
archive=read('archive-analysis.json');assert archive['renamedFiles']==14 and archive['byteIdenticalAtRenameAndRef']
story=read('story-verification.json');assert [story[k] for k in ['storyEvents','storyDialogueRows','combatExchanges','combatDialogueRows']]==[33,101,12,33]
assert story['multilineMutation']=={'godotDataUnchanged':True,'exportedRows':100,'missingRows':1}
assert story['validatorMutations']==3 and story['allStoryMetadataAndFieldsMatchRuntime']
assert not story['uiInspected'] and not story['entireGameRun'] and not story['releaseBuildExported']
assert blocks(texts['O11'],'sh')==['git diff-tree -r --name-status -M 5198488^ 5198488\n']
assert blocks(texts['O14'],'sh')==['node tools/export-dialogue-review.mjs\n']
assert blocks(texts['O08'],'sh')==['git status --short\ngit rev-parse HEAD\n','git show 6fe4649:production/2026-09/catalog.json\n']
assert blocks(texts['O02'],'yaml')==['published: false\ncanonical_url: null\n']
audit=read('humanizer-audit.json');assert len(audit['files'])==12
for x in audit['files']:
    assert sha((ROOT/x['path']).read_bytes())==x['after_sha256']
    assert x['frontmatter_code_links_numeric_tokens_unchanged']
def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT)
base=git('ls-tree','-r','--name-only','8a1bfa8').decode().splitlines()
protected=[p for p in base if p!='ARTICLE_IDEAS_2026-09.md']
for path in protected:assert (ROOT/path).read_bytes()==git('show','8a1bfa8:'+path),path
prior=git('ls-tree','-r','--name-only','6fe4649','articles','public','devto').decode().splitlines()
prior=[x for x in prior if x.endswith('.md')]
for path in prior:assert (ROOT/path).read_bytes()==git('show','6fe4649:'+path),path
strip=lambda text:re.sub(r'\n<!-- production-progress:start -->[\s\S]*?<!-- production-progress:end -->\n?','',text)
assert strip((ROOT/'ARTICLE_IDEAS_2026-09.md').read_text())==git('show','8a1bfa8:ARTICLE_IDEAS_2026-09.md').decode()
# Hash every fixed source, including source files outside this repository.
sources=read('repository-sources.json')
for x in sources:
    repo=ROOT if x['repository']=='articles' else ROOT.parent/x['repository']
    data=subprocess.check_output(['git','-C',str(repo),'show',x['ref']+':'+x['path']])
    assert sha(data)==x['sha256'] and len(data)==x['bytes']
guard={'baseline':'8a1bfa8','beforeBatch':'6fe4649','baselineFilesUnchanged':len(protected),'previousArticleFilesUnchanged':len(prior),'originalIdeasUnchanged':True,'finalHumanizerHashes':12,'fixedGitSources':len(sources),'localHookUnchanged':True}
(OUT/'repository-guard.json').write_text(json.dumps(guard,indent=2)+'\n')
report={'articlePairs':6,'printedExecutableBlocks':6,'otherPrintedBlocks':3,'printedCoverageFunctionCases':4,'canonicalMockCases':6,'identityMockCases':6,'handoffChecks':5,'story':{k:story[k] for k in ['storyEvents','storyDialogueRows','combatExchanges','combatDialogueRows','validatorMutations','multilineMutation']},'archiveFiles':14,'humanizerProseEdits':sum(x['prose_edits'] for x in audit['files']),'guard':guard}
(OUT/'snippet-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False,indent=2))
