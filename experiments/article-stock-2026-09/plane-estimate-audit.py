"""Read-only snapshot analysis. Does not model Plane throughput or write tickets."""
import json, pathlib, sys
ROOT=pathlib.Path(__file__).resolve().parents[2]
SOURCE=ROOT/'production/2026-09/batch-06/plane-snapshot.json'

def summarize_open(items):
    active = [x for x in items if x['group'] not in {'completed', 'cancelled'}]
    missing = [x['identifier'] for x in active if x['points'] is None]
    if missing:
        raise ValueError(f'Missing points: {missing}')
    if any(x['points'] not in {1, 2, 3, 5, 8} for x in active):
        raise ValueError('Unexpected point scale')
    if len({x['identifier'] for x in active}) != len(active):
        raise ValueError('Duplicate work item')
    return {'count': len(active), 'points': sum(x['points'] for x in active)}

def main():
    snapshot=json.loads(SOURCE.read_text()); items=snapshot['items']
    assert snapshot['paginationComplete'] and snapshot['total']==len(items)==52
    assert len({x['identifier'] for x in items})==52
    assert snapshot['estimate']['values']==[1,2,3,5,8]
    total=summarize_open(items)
    groups={g:summarize_open([x for x in items if x['group']==g]) for g in ['backlog','unstarted','started']}
    assert total=={'count':22,'points':148}
    assert groups['started']=={'count':6,'points':48}
    assert all(x['points']==8 for x in items if x['group']=='started')
    by_id={x['identifier']:x for x in items}
    comparisons={}
    for name,ids in [('three_smaller',['SQN-10','SQN-12','SQN-13']),('three_larger',['SQN-9','SQN-30','SQN-39'])]:
        comparisons[name]={'ids':ids,**summarize_open([by_id[i] for i in ids])}
    assert comparisons['three_smaller']['points']==11
    assert comparisons['three_larger']['points']==24
    # Mutated local inputs exercise refusal, never update the live workspace.
    bad_inputs={
      'missing':[{**by_id['SQN-10'],'points':None}],
      'zero':[{**by_id['SQN-10'],'points':0}],
      'unknown_scale':[{**by_id['SQN-10'],'points':13}],
      'duplicate':[by_id['SQN-10'],by_id['SQN-10']],
    }
    refused={}
    for name,values in bad_inputs.items():
        try: summarize_open(values)
        except ValueError as e: refused[name]=str(e)
        else: raise AssertionError(name)
    excluded=[x for x in items if x['group'] in {'completed','cancelled'}]
    result={'python':sys.version.split()[0],'snapshotDate':snapshot['checkedOn'],'totalOpen':total,'groups':groups,'comparisons':comparisons,'excludedMissingPoints':sum(x['points'] is None for x in excluded),'refusalChecks':refused,'limits':['A current inventory, not a cycle history or capacity estimate','Parent and child scope may overlap; no automatic subtraction','Existing points may describe original or remaining imported scope','No velocity or hours inferred; no live mutation']}
    (ROOT/'production/2026-09/batch-06/estimate-audit.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(result,ensure_ascii=False))

if __name__=='__main__':main()
