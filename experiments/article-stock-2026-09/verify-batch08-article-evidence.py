"""Match article examples to executed cases, and protect the pre-batch repository."""
import hashlib
import json
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'production/2026-09/batch-08'
EXP = Path(__file__).parent / 'language-batch08'
read = lambda name: json.loads((OUT / name).read_text())
sha = lambda value: hashlib.sha256(value).hexdigest()
catalog = json.loads((ROOT / 'production/2026-09/catalog.json').read_text())
items = [x for x in catalog if x['batch'] == 8]
assert len(items) == 6
cases = json.loads((EXP / 'compiler-cases.json').read_text())
results = read('compiler-results.json')
assert len(cases) == len(results['cases']) == 31
assert results['environment'] == {'node': 'v24.15.0', 'platform': 'darwin', 'arch': 'arm64', 'typescript': 'Version 7.0.2', 'esbuild': '0.28.2'}
executed = {x['name']: x for x in results['cases']}
for case in cases:
    actual = executed[case['name']]
    assert actual['diagnosticCodes'] == sorted(case['expectedDiagnostics']), case['name']
    assert (actual['exit'] == 0) == (not case['expectedDiagnostics'])
    if actual['exit'] == 0:
        assert actual['runtime']['exit'] == 0
        if 'expectedRuntime' in case:
            assert actual['runtime']['stdout'] == case['expectedRuntime']
    if 'esbuild' in case:
        assert actual['esbuild']['exit'] == actual['esbuild']['runtime']['exit'] == 0
        assert actual['esbuild']['runtime']['stdout'] == case['esbuild']['expectedRuntime']
assert 'var State' not in executed['const-enum-false']['javascript']
assert 'var State' in executed['const-enum-true']['javascript']
assert 'import {} from "./registry.js"' in executed['import-inline-type-true']['javascript']
assert 'registry.js' not in executed['import-whole-type-true']['javascript']
assert executed['enum-erasable']['nodeStrip']['exit'] != 0
assert 'ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX' in executed['enum-erasable']['nodeStrip']['stderr']

snippets = []
for item in items:
    sources = []
    for case in cases:
        if case['article'] == item['id']:
            sources.extend(case['files'].values())
            sources.extend(executed[case['name']].get(field, '') for field in ['javascript', 'declaration'])
    sources.extend((EXP / name).read_text() for name in ['clone-example.mjs', 'cancellable-delay.mjs', 'abort-example.mjs'])
    body = (ROOT / item['japanese']).read_text()
    blocks = re.findall(r'^```(ts|js)\n(.*?)^```', body, re.M | re.S)
    assert blocks
    for index, (language, snippet) in enumerate(blocks):
        snippet = snippet.strip()
        if any(snippet in source for source in sources):
            method = 'exact source or emitted file from executed case'
        else:
            assert item['id'] == 'T07' and 'transfer:' in snippet, (item['id'], snippet)
            result = subprocess.check_output(['node', '--input-type=module', '-e', snippet], text=True)
            assert result.strip() == '0 [ 1, 2, 3 ]'
            method = 'article transfer snippet executed in Node.js'
        snippets.append({'id': item['id'], 'block': index + 1, 'language': language, 'sha256': sha(snippet.encode()), 'verification': method})

clone = read('clone-results.json')
assert len(clone['cases']) == 12
assert clone['getterReadsAcrossBothCopies'] == 2
assert clone['transfer'] == {'sourceByteLength': 0, 'destination': [1, 2, 3]}
assert clone['example'] == 'true string\n2 {}\ntrue false\nundefined null\ntrue false'
assert clone['example'] in (ROOT / next(x['japanese'] for x in items if x['id'] == 'T07')).read_text()
abort = read('abort-results.json')
assert len(abort['cases']) == 7
assert all(x.get('remainingListeners', 0) == 0 for x in abort['cases'])
assert next(x for x in abort['cases'] if x['name'] == 'shared-signal')['statuses'] == ['rejected', 'rejected']
assert next(x for x in abort['cases'] if x['name'] == 'task-without-signal')['ignoredTaskFinished']
assert next(x for x in abort['cases'] if x['name'] == 'node-timers-promise')['causeIsReason']
abort_example = subprocess.check_output(['node', str(EXP / 'abort-example.mjs')], text=True)
assert abort_example.strip() == "[ 'rejected', 'rejected' ]\ntrue"

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
prior = [p for p in tree('bfee37e', 'articles', 'public', 'devto') if p.endswith('.md')]
for path in prior:
    assert (ROOT / path).read_bytes() == git('show', 'bfee37e:' + path), path
guard = {'baseline': '8a1bfa8', 'beforeBatch': 'bfee37e', 'baselineFilesUnchanged': len(baseline), 'previousArticleFilesUnchanged': len(prior), 'humanizerFinalHashesMatched': 12, 'exception': 'ARTICLE_IDEAS_2026-09.md production progress block'}
(OUT / 'repository-guard.json').write_text(json.dumps(guard, indent=2) + '\n')
report = {'articleSnippets': snippets, 'compilerCases': len(cases), 'esbuildCases': sum('esbuild' in x for x in cases), 'cloneCases': 12, 'transferCases': 1, 'cancellationCases': 7, 'guard': guard}
(OUT / 'snippet-verification.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({'snippets': len(snippets), **{k: v for k, v in report.items() if k != 'articleSnippets'}}, indent=2))
