"""Check Plane article claims, query snippets, prose hashes, and repository guards."""
import hashlib
import json
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'production/2026-09/batch-11'
read = lambda name: json.loads((OUT / name).read_text())
sha = lambda value: hashlib.sha256(value).hexdigest()
catalog = json.loads((ROOT / 'production/2026-09/catalog.json').read_text())
items = [x for x in catalog if x['batch'] == 11]
assert {x['id'] for x in items} == {'P05', 'P06', 'P07', 'P11', 'P12', 'P13'}
data = read('plane-read-results.json')
analysis = read('plane-analysis.json')
assert len(data['queries']) == analysis['queries'] == 17
assert len(data['items']) == sum(analysis['projects'].values()) == 233
assert analysis['views'] == {'open': 174, 'due_by_day': 15, 'due_unassigned': 15, 'no_due_date': 56, 'unassigned': 168}
assert analysis['priorityGroups']['grouped']['total'] == 121
assert analysis['priorityGroups']['ungrouped']['total'] == 150
assert analysis['priorityGroups']['ungrouped']['states']['completed'] == 29
assert analysis['squadNote'] == {'items': 52, 'labelled': 0, 'priorities': {'high': 21, 'medium': 25, 'low': 6}, 'states': {'completed': 29, 'started': 6, 'backlog': 11, 'unstarted': 5, 'cancelled': 1}}
assert len(analysis['localBoundaryFixture']['items']) == 7
assert analysis['localBoundaryFixture']['result'] == {'open': 5, 'due_by_day': 3, 'due_unassigned': 1, 'no_due_date': 1, 'unassigned': 2}
queries = {x['pql']: x for x in data['queries']}
snippets = []
for item in items:
    ja, en = [(ROOT / item[key]).read_text() for key in ['japanese', 'english']]
    ja_queries = re.findall(r'^```pql\n(.*?)^```', ja, re.M | re.S)
    en_queries = re.findall(r'^```pql\n(.*?)^```', en, re.M | re.S)
    assert ja_queries == en_queries
    for index, block in enumerate(ja_queries):
        query = block.strip()
        assert query in queries, (item['id'], query)
        response = queries[query]['response']
        if query == 'state__group = "started"':
            assert response['error'] == "Filtering on field 'state__group' is not allowed"
        else:
            assert isinstance(response['total_count'], int)
        snippets.append({'id': item['id'], 'block': index + 1, 'language': 'pql', 'query': query, 'sha256': sha(query.encode()), 'result': 'expected rejection' if 'error' in response else response['total_count']})
assert len(snippets) == 10

proposals = read('proposed-configurations.json')
maintenance = proposals['recurringMaintenance']
assert maintenance['observedSchedulerRuns'] == 0 and len(maintenance['descriptionFields']) == 5
assert [(x['occurrence'], x['templateVersion'], x['evidence']) for x in maintenance['ledgerExample']] == [('2026-09-11', 'v1', '未記録'), ('2026-09-18', 'v2', '未記録')]
assert len(proposals['intakeDecisions']) == 4
assert all(x['requiredRecord'] for x in proposals['intakeDecisions'])
template = proposals['projectTemplate']
assert template['createdPlaneProjects'] == 0 and len(template['initialTasks']) == 3 and len(template['localApplications']) == 2
assert all(x['initialTaskKeys'] == [task['key'] for task in template['initialTasks']] for x in template['localApplications'])
assert len({x['identifierProposal'] for x in template['localApplications']}) == 2
assert len({x['deliveryProposal'] for x in template['localApplications']}) == 2
assert len({x['verificationProposal'] for x in template['localApplications']}) == 2
assert 'not Plane API payloads' in proposals['status']
# These are manual design inputs, not a simulated proof of Plane's behavior.
ja_maintenance = (ROOT / 'public/plane-recurring-maintenance.md').read_text()
assert re.findall(r'^```text\n(.*?)^```', ja_maintenance, re.M | re.S) == ['\n'.join(x + ':' for x in maintenance['descriptionFields']) + '\n']
assert 'Planeが実際に生成した記録ではありません' in ja_maintenance
assert '実際の依頼や、Plane上の処理結果ではありません' in (ROOT / 'public/plane-intake-before-backlog.md').read_text()
assert 'Planeが初期タスクを生成した結果ではなく' in (ROOT / 'public/plane-project-template.md').read_text()
assert not data['squadNote']['features']['intakes']
assert data['toolLimitations']['projectTemplateList']['content'] == []
assert data['toolLimitations']['projectTemplateListInterpretation'] == 'Empty content is not evidence of an empty template collection.'

audit = read('humanizer-audit.json')
assert len(audit['files']) == 12
assert sum(x['prose_edits'] for x in audit['files']) == 24
for entry in audit['files']:
    assert sha((ROOT / entry['path']).read_bytes()) == entry['after_sha256']
    assert entry['frontmatter_code_links_numeric_tokens_unchanged']

def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT)
def tree(ref, *paths):
    return git('ls-tree', '-r', '--name-only', ref, *paths).decode().splitlines()
baseline = [x for x in tree('8a1bfa8') if x != 'ARTICLE_IDEAS_2026-09.md']
for path in baseline:
    assert (ROOT / path).read_bytes() == git('show', '8a1bfa8:' + path), path
prior = [x for x in tree('5692e28', 'articles', 'public', 'devto') if x.endswith('.md')]
for path in prior:
    assert (ROOT / path).read_bytes() == git('show', '5692e28:' + path), path
ideas = 'ARTICLE_IDEAS_2026-09.md'
strip_progress = lambda value: re.sub(r'\n<!-- production-progress:start -->[\s\S]*?<!-- production-progress:end -->\n?', '', value)
assert strip_progress((ROOT / ideas).read_text()) == git('show', '8a1bfa8:' + ideas).decode()
guard = {'baseline': '8a1bfa8', 'beforeBatch': '5692e28', 'baselineFilesUnchanged': len(baseline), 'previousArticleFilesUnchanged': len(prior), 'humanizerFinalHashesMatched': 12, 'originalIdeaContentUnchanged': True, 'exception': 'ARTICLE_IDEAS_2026-09.md production progress block only'}
(OUT / 'repository-guard.json').write_text(json.dumps(guard, indent=2) + '\n')
report = {'pqlSnippets': snippets, 'liveReadQueries': 17, 'snapshotRows': 233, 'localBoundaryCases': 7, 'manualProposalReview': {'maintenanceFields': 5, 'intakeExamples': 4, 'initialProjectTasks': 3, 'fictionalProjects': 2, 'liveSchedulerOrProjectCreations': 0}, 'guard': guard}
(OUT / 'snippet-verification.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({k: len(v) if k == 'pqlSnippets' else v for k, v in report.items()}, ensure_ascii=False, indent=2))
