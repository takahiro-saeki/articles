"""Recompute read-only Plane query observations without writing to Plane."""
from collections import Counter
from datetime import date
import hashlib
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'production/2026-09/batch-11'
data = json.loads((OUT / 'plane-read-results.json').read_text())
items = data['items']
queries = {x['name']: x['response'] for x in data['queries']}
assert len(items) == len({x['identifier'] for x in items}) == 233
assert [x['count'] for x in data['pagination']] == [100, 100, 33]
assert [x['next_page_results'] for x in data['pagination']] == [True, True, False]
today = date(2026, 9, 11)

def is_open(item):
    return item['group'] in {'backlog', 'unstarted', 'started'}

def due_by(item, day):
    return item['dueDate'] is not None and date.fromisoformat(item['dueDate']) <= day

def audit_views(items, day):
    active = [item for item in items if is_open(item)]
    return {
        'open': len(active),
        'due_by_day': sum(due_by(item, day) for item in active),
        'due_unassigned': sum(due_by(item, day) and item['assigneeCount'] == 0 for item in active),
        'no_due_date': sum(item['dueDate'] is None for item in active),
        'unassigned': sum(item['assigneeCount'] == 0 for item in active),
    }

views = audit_views(items, today)
assert views == {'open': 174, 'due_by_day': 15, 'due_unassigned': 15, 'no_due_date': 56, 'unassigned': 168}
query_values = {'all-open': views['open'], 'fixed-date-open': views['due_by_day'], 'today-all-open': views['due_by_day'], 'today-unassigned': views['due_unassigned'], 'open-no-date': views['no_due_date'], 'open-unassigned': views['unassigned']}
query_values['overdue'] = sum(is_open(x) and x['dueDate'] is not None and date.fromisoformat(x['dueDate']) < today for x in items)
query_values['open-missing-label'] = sum(is_open(x) and len(x['labels']) == 0 for x in items)
query_values['correct-field'] = sum(x['group'] == 'started' for x in items)
for name, expected in query_values.items():
    assert queries[name]['total_count'] == expected, name
assert queries['caller-open']['total_count'] == 6
assert queries['today-assigned']['total_count'] == 0
# No assignment exists in the due set, independently supporting the caller's zero.
assert all(x['assigneeCount'] == 0 for x in items if is_open(x) and due_by(x, today))

grouped = [x for x in items if is_open(x) and x['priority'] in {'urgent', 'high'}]
ungrouped = [x for x in items if (is_open(x) and x['priority'] == 'urgent') or x['priority'] == 'high']
groups = {}
for name, selected in [('grouped', grouped), ('ungrouped', ungrouped)]:
    counts = dict(sorted(Counter(x['group'] for x in selected).items()))
    assert queries[name + '-priority']['total_count'] == len(selected)
    response = queries[name + '-breakdown']
    assert response['total_count'] == len(selected)
    assert {k: v['count'] for k, v in response['grouped_counts'].items()} == counts
    groups[name] = {'total': len(selected), 'states': counts}
assert len(grouped) == queries['priority-in']['total_count'] == 121 and len(ungrouped) == 150
assert groups['ungrouped']['states']['completed'] == 29
assert queries['invalid-field']['error'] == "Filtering on field 'state__group' is not allowed"

# Boundary inputs exercise this local audit function, not Plane's PQL parser or UI.
fixture = [
    {'identifier': 'CASE-1', 'group': 'started', 'dueDate': '2026-09-10', 'assigneeCount': 1},
    {'identifier': 'CASE-2', 'group': 'unstarted', 'dueDate': '2026-09-11', 'assigneeCount': 1},
    {'identifier': 'CASE-3', 'group': 'unstarted', 'dueDate': '2026-09-12', 'assigneeCount': 1},
    {'identifier': 'CASE-4', 'group': 'backlog', 'dueDate': None, 'assigneeCount': 0},
    {'identifier': 'CASE-5', 'group': 'completed', 'dueDate': '2026-09-10', 'assigneeCount': 1},
    {'identifier': 'CASE-6', 'group': 'cancelled', 'dueDate': '2026-09-10', 'assigneeCount': 1},
    {'identifier': 'CASE-7', 'group': 'started', 'dueDate': '2026-09-11', 'assigneeCount': 0},
]
fixture_result = audit_views(fixture, today)
assert fixture_result == {'open': 5, 'due_by_day': 3, 'due_unassigned': 1, 'no_due_date': 1, 'unassigned': 2}
squad = [x for x in items if x['project'] == 'SQN']
assert len(squad) == 52 and all(x['labels'] == [] for x in squad)
assert data['squadNote']['labels']['count'] == 0 and not data['squadNote']['labels']['next_page_results']
assert not data['squadNote']['features']['intakes'] and data['squadNote']['features']['views']
report = {'checkedOn': '2026-09-11', 'python': sys.version.split()[0], 'scope': 'non-archived accessible workspace snapshot; local predicates checked against live PQL counts', 'projects': dict(sorted(Counter(x['project'] for x in items).items())), 'views': views, 'priorityGroups': groups, 'squadNote': {'items': len(squad), 'labelled': 0, 'priorities': dict(Counter(x['priority'] for x in squad)), 'states': dict(Counter(x['group'] for x in squad))}, 'localBoundaryFixture': {'items': fixture, 'result': fixture_result}, 'queries': len(data['queries'])}
(OUT / 'plane-analysis.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')

repo = Path('/Users/takahiro_saeki/Documents/GitHub/circle-hub')
source_specs = [
    ('e295f5cedf9f8989b36c9f308dee4dbd8cf64c3f', 'docs/marketing/instagram/001-invite-join/README.md', ['SQN-47', 'index.html', 'styles.css']),
    ('e295f5cedf9f8989b36c9f308dee4dbd8cf64c3f', 'docs/marketing/instagram/001-invite-join/index.html', ['<!DOCTYPE html>']),
    ('770de5f2989775cfd95f7a9c4529565a2b48d2fd', 'docs/architecture.md', ['技術スタック', 'ディレクトリ構成']),
]
sources = []
for ref, path, markers in source_specs:
    body = subprocess.check_output(['git', '-C', str(repo), 'show', ref + ':' + path])
    assert all(marker.lower() in body.decode().lower() for marker in markers), path
    history = subprocess.check_output(['git', '-C', str(repo), 'log', '-3', '--format=%H %cs %s', ref, '--', path], text=True).splitlines()
    sources.append({'repository': 'takahiro-saeki/circle-hub', 'commit': ref, 'path': path, 'sha256': hashlib.sha256(body).hexdigest(), 'bytes': len(body), 'history': history, 'url': 'https://github.com/takahiro-saeki/circle-hub/blob/' + ref + '/' + path})
(OUT / 'repository-sources.json').write_text(json.dumps(sources, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({k: v for k, v in report.items() if k != 'localBoundaryFixture'}, ensure_ascii=False, indent=2))
