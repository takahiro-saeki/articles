"""Match the six article pairs to recorded browser/type cases and protect prior work."""
from collections import Counter
import hashlib
import json
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'production/2026-09/batch-09'
EXP = Path(__file__).parent / 'react-batch09'
read = lambda name: json.loads((OUT / name).read_text())
sha = lambda value: hashlib.sha256(value).hexdigest()
items = [x for x in json.loads((ROOT / 'production/2026-09/catalog.json').read_text()) if x['batch'] == 9]
assert len(items) == 6
records = read('browser-results.json')['records']
counts = Counter(x['kind'] for x in records)
assert counts == {'keys': 6, 'forms': 9, 'store': 1, 'action': 4, 'manual': 3, 'preserve': 2, 'effects': 5, 'refs': 6, 'hydration': 2}
environment = read('environment.json')
assert environment['packages'] == {'react': '19.3.0', 'react-dom': '19.3.0', 'esbuild': '0.28.2', '@types/react': '19.3.0', 'typescript': '7.0.2'}
assert environment['node'] == 'v24.15.0' and environment['arch'] == 'arm64'
assert 'HeadlessChrome/152.0.0.0' in environment['browser']
assert environment['ssr']['html'] == '<output id="store-count">0</output>'
assert 'Missing getServerSnapshot' in environment['ssr']['missingSnapshotError']

for case in records:
    kind, options, result = case['kind'], case['options'], case['result']
    if kind == 'keys':
        correct = options['keyMode'] == 'id' or options['mode'] == 'parent'
        assert [x['value'] for x in result['after']] == (['edited-B', 'Gamma'] if correct else ['Alpha', 'edited-B'])
        assert [x['original'] for x in result['after']] == (['B', 'C'] if options['keyMode'] == 'id' else ['A', 'B'])
    elif kind == 'forms':
        mode, size = options['mode'], options['size']
        assert result['delta'] == {'form': int(mode == 'root'), 'fields': size if mode == 'root' else int(mode == 'local'), 'changes': int(mode != 'uncontrolled')}
        assert result['submittedCount'] == size and result['submittedFirst'] == 'edited'
        assert result['nativeReset'] == ('field-0' if mode == 'uncontrolled' else 'edited')
        assert result['explicitReset'] == 'field-0'
    elif kind == 'effects':
        extra = case['environment'] == 'development' and options['strict']
        cleanup = options['cleanup']
        expected = ['setup:A', 'cleanup:A', 'setup:A'] if extra and cleanup else ['setup:A'] * (2 if extra else 1)
        assert result['mounted']['events'] == expected
        assert [result[x]['active'] for x in ['mounted', 'changed', 'unmounted']] == ([1, 1, 0] if cleanup else [2, 3, 3])
        assert result['emitted']['events'].count('message:A') == (1 if cleanup else 2)
    elif kind == 'refs':
        cleanup = ['null', 'cleanup'] if options['legacy'] else ['cleanup']
        mounted = ['attach'] if case['environment'] == 'production' else ['attach', *cleanup, 'attach']
        updated = mounted if options['stable'] else [*mounted, *cleanup, 'attach']
        assert result['mounted']['events'] == mounted
        assert result['updated']['events'] == updated and result['updated']['sameNode']
        assert result['unmounted']['events'] == [*updated, *cleanup]
        assert [result[x]['active'] for x in ['mounted', 'updated', 'unmounted']] == [1, 1, 0]
    elif kind == 'store':
        assert [(result[x]['count'], result[x]['dom'], result[x]['trace']['events']) for x in ['initial', 'mutated', 'replaced']] == [(0, '0', [0]), (1, '0', [0]), (2, '2', [0, 2])]
        assert result['initial']['subscribers'] == 1 and result['subscribersAfterUnmount'] == 0
    elif kind == 'hydration':
        matching = options['mode'] == 'matching'
        assert result['renders'] == ([0, 1] if matching else [2, 1])
        assert len(result['errors']) == (0 if matching else 1)
        assert result['count'] == '1' and result['subscribers'] == 1
    elif result.get('queue'):
        assert [(len(result[x]['trace']['calls']), result[x]['state']['count'], result[x]['pending']) for x in ['first', 'second', 'finished']] == [(1, 0, 'true'), (2, 0, 'true'), (2, 2, 'false')]
        assert result['second']['trace']['calls'][1]['previous'] == {'count': 1, 'message': 'saved:first'}
        assert result['finished']['state']['message'] == 'saved:second'
    else:
        name, finished = result['name'], result['finished']
        assert result['pending']['pending'] == 'true' and result['pending']['input'] == name
        if kind == 'action' and name == 'crash':
            assert finished['error'] == 'simulated failure' and finished['input'] is None and finished['state'] is None
        else:
            assert finished['state']['count'] == int(name == 'good')
            expected = 'saved:good' if name == 'good' else 'invalid' if name == 'bad' else 'simulated failure'
            assert finished['state']['message'] == expected
            expected_input = name if kind == 'manual' or (kind == 'preserve' and name == 'bad') else ''
            assert finished['input'] == expected_input

types = read('ref-type-results.json')['cases']
assert len(types) == 3
for case in types:
    assert case['codes'] == case['expected']
    assert (case['exit'] == 0) == (case['name'] == 'cleanup-void-return')

sources = [p.read_text() for p in EXP.iterdir() if p.suffix in {'.mjs', '.jsx'}]
sources.extend(x['source'] for x in types)
snippets = []
for item in items:
    body = (ROOT / item['japanese']).read_text()
    for index, (language, snippet) in enumerate(re.findall(r'^```(js|jsx|tsx|html)\n(.*?)^```', body, re.M | re.S)):
        snippet = snippet.strip()
        if language == 'html':
            assert snippet == environment['ssr']['html']
            method = 'exact server-rendered HTML'
        else:
            assert any(snippet in source for source in sources), (item['id'], snippet)
            method = 'exact excerpt from executed fixture or type-check input'
        snippets.append({'id': item['id'], 'block': index + 1, 'language': language, 'sha256': sha(snippet.encode()), 'verification': method})
assert len(snippets) == 14

audit = read('humanizer-audit.json')
assert len(audit['files']) == 12
for entry in audit['files']:
    assert sha((ROOT / entry['path']).read_bytes()) == entry['after_sha256']
    assert entry['frontmatter_code_links_numeric_tokens_unchanged']

def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT)
def tree(ref, *paths):
    return git('ls-tree', '-r', '--name-only', ref, *paths).decode().splitlines()
baseline = [p for p in tree('8a1bfa8') if p != 'ARTICLE_IDEAS_2026-09.md']
for path in baseline:
    assert (ROOT / path).read_bytes() == git('show', '8a1bfa8:' + path), path
prior = [p for p in tree('d75d8a3', 'articles', 'public', 'devto') if p.endswith('.md')]
for path in prior:
    assert (ROOT / path).read_bytes() == git('show', 'd75d8a3:' + path), path
guard = {'baseline': '8a1bfa8', 'beforeBatch': 'd75d8a3', 'baselineFilesUnchanged': len(baseline), 'previousArticleFilesUnchanged': len(prior), 'humanizerFinalHashesMatched': 12, 'exception': 'ARTICLE_IDEAS_2026-09.md production progress block'}
(OUT / 'repository-guard.json').write_text(json.dumps(guard, indent=2) + '\n')
report = {'articleSnippets': snippets, 'browserCases': len(records), 'caseKinds': dict(counts), 'typeCases': len(types), 'guard': guard}
(OUT / 'snippet-verification.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({'snippets': len(snippets), **{k: v for k, v in report.items() if k != 'articleSnippets'}}, indent=2))
