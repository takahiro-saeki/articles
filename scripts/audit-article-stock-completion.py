"""Read current drafts and saved evidence; never publish, schedule, or assign URLs."""
import hashlib,json,pathlib,re,subprocess
from datetime import datetime
from zoneinfo import ZoneInfo
ROOT=pathlib.Path(__file__).resolve().parents[1]
PLAN_PATH=ROOT/'production/2026-09/scheduling/approved-plan.json'
PLAN=json.loads(PLAN_PATH.read_text()) if PLAN_PATH.exists() else None
OUT=ROOT/('production/2026-09/scheduling/completion-audit' if PLAN else 'production/2026-09/completion-audit')
OUT.mkdir(parents=True,exist_ok=True)
read=lambda p:json.loads((ROOT/p).read_text())
sha=lambda value:hashlib.sha256(value.encode() if isinstance(value,str) else value).hexdigest()
def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT,text=True)
def run(*args):return subprocess.run(args,cwd=ROOT,text=True,capture_output=True)
def save(name,value):(OUT/name).write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')
cat=read('production/2026-09/catalog.json');assert len(cat)==90
expected={prefix+f'{i:02}' for prefix,count in [('P',20),('T',45),('O',25)] for i in range(1,count+1)}
assert {x['id'] for x in cat}==expected
ideas=(ROOT/'ARTICLE_IDEAS_2026-09.md').read_text()
original=git('show','8a1bfa8:ARTICLE_IDEAS_2026-09.md')
strip=lambda s:re.sub(r'\n<!-- production-progress:start -->[\s\S]*?<!-- production-progress:end -->\n?','',s)
assert strip(ideas)==original
for x in cat:
 row=next(s for s in original.splitlines() if re.match(r'^\| '+x['id']+r' \|',s))
 cells=[s.strip() for s in row.split('|')[1:-1]]
 assert cells[-2:]==[x['preparation'],x['platform']]
 assert cells[1]==x['original_title']
priorities=[x for x in cat if x['priority'] is not None]
assert len(priorities)==12 and {x['priority'] for x in priorities}==set(range(1,13))
assert all(x['batch'] in [1,2] for x in priorities)
content=run('node','scripts/validate-article-stock.mjs','--all','--allow-pending-canonical')
assert content.returncode==0,content.stderr
validation=json.loads(content.stdout);assert validation['pairs']==90
save('all-content-validation.json',validation)
strict=run('node','scripts/validate-article-stock.mjs','--all')
pending=[x for x in cat if x.get('canonical_status')=='URL未確定']
if pending:
 assert strict.returncode!=0 and 'canonical policy must be resolved' in strict.stderr
else:assert strict.returncode==0,strict.stderr
save('strict-completion-gate.json',{'command':'node scripts/validate-article-stock.mjs --all','exit_code':strict.returncode,'canonical_pending_ids':[x['id'] for x in pending],'stderr':strict.stderr})
invalid=run('node','scripts/validate-article-stock.mjs','--all','--batch=15')
assert invalid.returncode!=0 and 'Use --all or --batch' in invalid.stderr
# Section parity is a structural check; saved semantic reviews cover translation meaning.
assert all(x['sectionsJA']==x['sectionsEN'] for x in validation['articles'])

def frozen(s):
 front=re.match(r'^---\n[\s\S]*?\n---\n',s).group()
 fences=re.findall(r'^```[^\n]*\n[\s\S]*?^```[ \t]*$',s,re.M)
 return [front,fences,re.findall(r'https?://[^\s)]+',s),re.findall(r'\d+(?:\.\d+)*',s)]
audit_files={};replayed=[];attested=[];batches=[];article_evidence=[]
for batch in sorted({x['batch'] for x in cat}):
 directory=pathlib.Path(f'production/2026-09/batch-{batch:02}')
 raw=read(directory/'humanizer-audit.json');files=raw if isinstance(raw,list) else raw['files']
 group=[x for x in cat if x['batch']==batch]
 assert 5<=len(group)<=10
 assert {x['path'] for x in files}=={x[k] for x in group for k in ['japanese','english']}
 review=next(directory/name for name in ['review.md','REVIEW.md'] if (ROOT/directory/name).exists())
 review_text=(ROOT/review).read_text()
 for item in files:
  path=item['path'];current=(ROOT/path).read_text()
  assert sha(current)==item['after_sha256'],path
  assert item.get('frontmatter_code_links_numeric_tokens_unchanged',item.get('frontmatter_code_links_numbers_unchanged'))
  assert item['semantic_review'] and item['prose_edits']>0
  audit_files[path]=item
  plan_paths=[directory/'humanizer-edits.json']
  if (ROOT/directory/'humanizer-followup-edits.json').exists():plan_paths.append(directory/'humanizer-followup-edits.json')
  if all((ROOT/p).exists() for p in plan_paths) and all(new for p in plan_paths for entry in read(p)['files'] if entry['path']==path for old,new in entry['edits']):
   before=current
   for plan_path in reversed(plan_paths):
    entry=next((x for x in read(plan_path)['files'] if x['path']==path),None)
    if entry is None:continue
    for old,new in reversed(entry['edits']):
     assert before.count(new)==1,(path,new)
     before=before.replace(new,old)
   assert sha(before)==item['before_sha256'],path
   assert frozen(before)==frozen(current),path
   replayed.append(path)
  else:attested.append(path)
 first_commits=set()
 for x in group:
  row=next(line for line in review_text.splitlines() if re.match(r'^\| '+x['id']+r' \|',line))
  path_records=[]
  for key in ['japanese','english']:
   path=x[key];first=git('log','--diff-filter=A','--format=%H','--',path).strip().splitlines()
   assert len(first)==1,(path,first)
   commit=first[0];first_commits.add(commit)
   # Later prose corrections may be committed; protected information stays the same.
   created=git('show',commit+':'+path);current=(ROOT/path).read_text()
   assert frozen(created)==frozen(current),path
   assert run('git','merge-base','--is-ancestor',commit,'origin/codex/article-stock-2026-09').returncode==0
   path_records.append({'path':path,'sha256':audit_files[path]['after_sha256'],'creation_commit':commit,'unchanged_from_creation':created==current})
  article_evidence.append({'id':x['id'],'title':x['title'],'preparation':x['preparation'],'platform':x['platform'],'status':x['status'],'batch':batch,'review':str(review),'review_row':row,'files':path_records})
 assert len(first_commits)==1,(batch,first_commits)
 batches.append({'batch':batch,'pairs':len(group),'ids':[x['id'] for x in group],'commit':next(iter(first_commits)),'review':str(review),'humanizer_records':len(files)})
assert len(audit_files)==180
base=[p for p in git('ls-tree','-r','--name-only','8a1bfa8').splitlines() if p!='ARTICLE_IDEAS_2026-09.md']
integration_base=PLAN['integration_base_commit'] if PLAN else '8a1bfa8'
authorized_changes=['README.md','schedule/publishing-schedule.json','scripts/publish-scheduled.mjs'] if PLAN else []
for p in base:
 if p in authorized_changes:continue
 expected_bytes=subprocess.check_output(['git','show',integration_base+':'+p],cwd=ROOT)
 assert (ROOT/p).read_bytes()==expected_bytes,p
assert len(base)==137
for name in ['articles/attendance-waitlist-concurrency-control.md','devto/attendance-waitlist-concurrency-control.md','public/drizzle-relational-queries-sql.md','devto/drizzle-relational-queries-sql.md']:
 assert name in base and name not in audit_files
zenn=run('npx','zenn','list:articles');assert zenn.returncode==0,zenn.stderr
(OUT/'zenn-list.txt').write_text(zenn.stdout)
assert run('git','diff','--check').returncode==0
inventory=[{'id':x['id'],'title':x['title'],'slug':x['slug'],'japanese':x['japanese'],'english':x['english'],'canonical_url':None,'state':'本文検証済み・公開予定URL未確定','evidence':f"production/2026-09/batch-{x['batch']:02}/"} for x in pending]
save('canonical-pending.json',inventory)
save('article-evidence.json',article_evidence)
report={'audited_on':datetime.now(ZoneInfo('Asia/Tokyo')).date().isoformat(),'base_commit':git('rev-parse','HEAD').strip(),'working_tree_drafts_included':True,'remote_ref':git('rev-parse','origin/codex/article-stock-2026-09').strip(),'candidate_pairs':90,'article_files':180,'categories':{'Plane':20,'technical':45,'other':25},'preparation_counts':{prep:sum(x['preparation']==prep for x in cat) for prep in ['A','B','C']},'complete':sum(x['status']=='完成' for x in cat),'canonical_pending':len(pending),'all_requirements_complete':not pending,'first_12_in_first_two_batches':True,'humanizer_final_hashes_matching':len(audit_files),'humanizer_reverse_edit_replay_files':len(replayed),'humanizer_original_audit_only_files':attested,'protected_baseline_files_unchanged':len(base)-len(authorized_changes),'baseline_comparison_commit':integration_base,'authorized_existing_file_changes':authorized_changes,'canonical_deferred_with_approval':sum(x.get('canonical_status')=='公開時に設定' for x in cat),'approval_record':str(PLAN_PATH.relative_to(ROOT)) if PLAN else None,'original_candidate_table_unchanged':True,'all_90_metadata_and_pair_checks_pass':True,'code_fences_per_language':sum(x['codeBlocks'] for x in validation['articles']),'same_section_counts':True,'zenn_list_exit_code':zenn.returncode,'diff_check_exit_code':0,'batch_commits':batches,'limitations':['Structural parity and hashes do not themselves prove translation quality or factual accuracy; per-article saved semantic and source reviews remain the evidence for those requirements.','Some edits have no reversible plan or remove prose without a unique insertion point. Their original audits attest the protected invariants; this audit still verifies current final hashes. These files are listed separately.','Experiments are not rerun by this inventory audit; the per-batch records retain their original date and stated scope.','Qiita canonical URLs may remain null in completed drafts under the 2026-09-12 user approval; the scheduled publisher must resolve them before publishing English articles. This audit does not itself activate GitHub scheduling.' if PLAN else 'Unresolved canonical URLs prevent full completion under the original instructions.']}
save('audit.json',report)
print(json.dumps({k:v for k,v in report.items() if k not in ['batch_commits','humanizer_original_audit_only_files','limitations']},ensure_ascii=False,indent=2))
