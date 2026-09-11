"""Match batch 10 article snippets and claims to executed fixtures and records."""
import ast
import hashlib
import json
from pathlib import Path
import re
import subprocess
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parents[2]
EXP = Path(__file__).parent
OUT = ROOT / 'production/2026-09/batch-10'
APP = EXP / 'next-batch10'
read = lambda name: json.loads((OUT / name).read_text())
sha = lambda value: hashlib.sha256(value).hexdigest()
items = [x for x in json.loads((ROOT / 'production/2026-09/catalog.json').read_text()) if x['batch'] == 10]
assert {x['id'] for x in items} == {'T10', 'T22', 'T23', 'T24', 'T25', 'T38'}

using = read('using-results.json')
assert using['environment'] == {'node': 'v24.15.0', 'platform': 'darwin', 'arch': 'arm64', 'transformed': False}
records = {x['name']: x for x in using['records']}
assert len(records) == 9
expected_events = {
    'normal': ['open:A', 'open:B', 'body', 'close:B', 'close:A'],
    'return': ['open:A', 'close:A', 'returned:done'],
    'body-throws': ['open:A', 'close:A', 'caught'],
    'acquisition-throws': ['open:A', 'open:B failed', 'close:A', 'caught'],
    'body-and-cleanups-throw': ['open:A', 'open:B', 'close:B', 'close:A'],
    'await-using': ['body', 'close start:B', 'close end:B', 'close start:A', 'close end:A', 'after work'],
    'using-only-async-dispose': [],
    'nullish': ['body'],
}
for name, events in expected_events.items():
    assert records[name]['events'] == events
error = records['body-and-cleanups-throw']['error']
assert error['name'] == error['suppressed']['name'] == 'SuppressedError'
assert error['error']['message'] == 'close failed:A'
assert error['suppressed']['error']['message'] == 'close failed:B'
assert error['suppressed']['suppressed']['message'] == 'body failed'
assert records['using-only-async-dispose']['error']['name'] == 'TypeError'
assert records['temporary-directory']['existedInside'] and not records['temporary-directory']['existsAfterThrow']
examples = read('using-article-examples.json')
assert len(examples) == 2 and all(x['exit'] == 0 for x in examples)
assert json.loads(examples[0]['stdout']) == {'value': 'done', 'events': expected_events['normal']}
assert examples[1]['stdout'] == 'inside: true\ncaught: work failed\nafter: false'

sqlite = read('sqlite-results.json')
assert sqlite['environment'] == {'python': '3.14.5', 'sqlite': '3.53.1'}
assert sqlite['parents'] == 101 and sqlite['children'] == 10000
assert len(sqlite['records']) == 4
for case, indexed in zip(sqlite['records'][:2], [False, True]):
    assert case['foreignKeys'] == 1 and case['parentIndexes'] == []
    assert len(case['childIndexes']) == int(indexed)
    expected = 'SEARCH child USING COVERING INDEX child_parent_idx (parent_id=?)' if indexed else 'SCAN child'
    assert [x[3] for x in case['selectPlan']] == [expected]
    assert [x[3] for x in case['deletePlan']] == ['SEARCH parent USING INTEGER PRIMARY KEY (rowid=?)', expected]
    assert case['errors'] == {'delete-referenced-parent': 'FOREIGN KEY constraint failed', 'insert-missing-parent': 'FOREIGN KEY constraint failed'}
    assert case['unreferencedParentDeleted'] and case['matchingChildren'] == 100
    if indexed:
        assert case['childIndexes'][0][1:4] == ['child_parent_idx', 0, 'c']
unique, disabled = sqlite['records'][2:]
assert unique['parentIndexes'] == [[0, 'sqlite_autoindex_parent_1', 1, 'u', 0]] and unique['childIndexes'] == []
assert disabled['foreignKeys'] == 0 and disabled['orphanInserted']
assert disabled['foreignKeyCheck'] == [['child', 1, 'parent', 0]]

environment = read('next-environment.json')
assert environment['versions'] == {'next': '16.3.4', 'react': '19.3.0', 'react-dom': '19.3.0', '@next/codemod': '16.3.4'}
assert environment['node'] == 'v24.15.0' and 'HeadlessChrome/152.0.0.0' in environment['browser']
assert environment['build'] == 'production webpack' and not environment['cacheComponents'] and not environment['reactCompiler']
package = json.loads((APP / 'package.json').read_text())
assert {**package['dependencies'], **package['devDependencies']} == environment['versions']
codemod = read('proxy-codemod.json')
assert codemod['version'] == '16.3.4' and codemod['exit'] == 0
assert codemod['before'] == (APP / 'cases/middleware.js').read_text()
assert codemod['after'] == codemod['before'].replace('export function middleware(', 'export function proxy(')
proxies = read('proxy-http-results.json')
assert [(x['method'], x['path'], x['status'], x['proxyHeader']) for x in proxies] == [
    ('GET', '/protected', 200, '/protected'),
    ('GET', '/protected/a/b', 200, '/protected/a/b'),
    ('GET', '/protected?x=1', 200, '/protected'),
    ('GET', '/protectedness', 404, None),
    ('GET', '/', 200, None),
    ('GET', '/plain.png', 200, None),
    ('POST', '/protected', 405, '/protected'),
]
runtime = read('runtime-http-results.json')
assert runtime['node'] == runtime['edge'] == {'text': 'fixture', 'bytes': 7, 'sha256': sha(b'fixture')}
assert runtime['file'] == {'text': 'local fixture only'} and runtime['eval'] == {'value': 3}
negatives = {x['name']: x for x in read('negative-build-results.json')}
assert len(negatives) == 3
assert negatives['proxy-runtime']['exit'] == negatives['edge-file']['exit'] == 1
assert 'Proxy always runs on Node.js runtime' in (OUT / negatives['proxy-runtime']['log']).read_text()
file_log = (OUT / negatives['edge-file']['log']).read_text()
assert all(x in file_log for x in ['UnhandledSchemeError', 'node:fs/promises', 'node:path', './lib/node-file.js'])
evaluation = negatives['edge-eval']
assert evaluation['exit'] == 0 and evaluation['runtimeStatus'] == 500 and evaluation['response'] == 'Internal Server Error'
assert 'EvalError: Code generation from strings disallowed for this context' in (OUT / evaluation['serverLog']).read_text()
assert 'deprecated' in (OUT / 'next-build.log').read_text()
for name in ['edge-file', 'edge-eval']:
    assert negatives[name]['source'] == (APP / 'cases' / (name + '.js')).read_text()

env = read('next-env-results.json')
assert [x['runtime'] for x in env] == ['B', 'C'] and env[0]['buildId'] == env[1]['buildId']
for case in env:
    assert case['static'] == {'server': 'server-build-A', 'public': 'public-build-A'}
    assert case['dynamic'] == {'server': 'server-runtime-' + case['runtime'], 'public': 'public-build-A'}
    assert case['client'] == {'direct': 'public-build-A', 'dynamic': None, 'alias': 'public-build-A', 'server': None}
bundle = read('client-bundle-evidence.json')
assert len(bundle) == 1
assert all(x in bundle[0]['excerpt'] for x in ['direct:"public-build-A"', 'alias:"public-build-A"', 'dynamic:s.env.NEXT_PUBLIC_ARTICLE_LABEL??null'])

images = read('image-results.json')
assert images['input'] == {'width': 1600, 'height': 1000, 'bytes': 494961, 'sha256': 'b6cdb4100ee988f5da227a48915a95633d15a5665b149a310b11ff2f66843253'}
before = {x['id']: x for x in images['beforeScroll']['images']}
after = {x['id']: x for x in images['afterScroll']['images']}
query = lambda url: parse_qs(urlparse(url).query)
assert images['beforeScroll']['viewport'] == 1280 and images['beforeScroll']['dpr'] == 1
for name, width in [('plain', 1600), ('fixed', 384), ('responsive', 640)]:
    assert before[name]['renderedWidth'] == 640 and before[name]['naturalWidth'] == width and before[name]['complete']
assert before['plain']['srcset'] is None and before['plain']['sizes'] is None
assert before['plain']['src'] == '/plain.png' and before['plain']['loading'] is None
assert query(before['fixed']['src'])['w'] == ['640'] and query(before['fixed']['currentSrc'])['w'] == ['384']
assert before['fixed']['sizes'] is None and ' 1x, ' in before['fixed']['srcset'] and before['fixed']['srcset'].endswith(' 2x')
assert query(before['responsive']['src'])['w'] == ['3840'] and query(before['responsive']['currentSrc'])['w'] == ['640']
assert before['responsive']['sizes'] == '50vw' and before['responsive']['srcset'].endswith(' 3840w')
for name in ['lazy-plain', 'lazy-next']:
    assert before[name]['naturalWidth'] == 0 and before[name]['currentSrc'] == '' and not before[name]['complete']
    assert after[name]['naturalWidth'] > 0 and after[name]['currentSrc'] and after[name]['complete']
    assert before[name]['loading'] == 'lazy' and before[name]['renderedWidth'] == 320
assert [(x['id'], x['status'], x['contentType'], x['bodyBytes']) for x in images['responses']] == [
    ('plain', 200, 'image/png', 494961), ('fixed', 200, 'image/webp', 926),
    ('responsive', 200, 'image/webp', 1842), ('lazy-plain', 200, 'image/png', 494961), ('lazy-next', 200, 'image/webp', 926),
]
assert {query(x['name'])['url'][0]: x['encodedBodySize'] for x in images['beforeScroll']['resources']} == {'/fixed.png': 926, '/responsive.png': 1842}

sources = [p.read_text() for p in APP.rglob('*') if p.is_file() and 'node_modules' not in p.parts and p.suffix in {'.js', '.jsx', '.mjs'}]
sources.extend((EXP / name).read_text() for name in ['using-order-example.mjs', 'using-directory-example.mjs'])
sources.append(codemod['after'])
sql_constants = [node.value for node in ast.walk(ast.parse((EXP / 'sqlite-foreign-key-child-index.py').read_text())) if isinstance(node, ast.Constant) and isinstance(node.value, str)]
normalize = lambda value: re.sub(r'\s+', ' ', value).strip().rstrip(';')
statements = {normalize(statement) for value in sql_constants for statement in value.split(';') if statement.strip()}
snippets = []
for item in items:
    body = (ROOT / item['japanese']).read_text()
    for index, (language, snippet) in enumerate(re.findall(r'^```(js|jsx|sql)\n(.*?)^```', body, re.M | re.S)):
        snippet = snippet.strip()
        if language == 'sql':
            assert all(normalize(statement) in statements for statement in snippet.split(';') if statement.strip()), (item['id'], snippet)
            method = 'same SQL statements as executed SQLite fixture, whitespace and terminal semicolons normalized'
        else:
            assert any(snippet == source.strip() for source in sources), (item['id'], snippet)
            method = 'exact full executed fixture file or codemod output'
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
prior = [p for p in tree('597e7cf', 'articles', 'public', 'devto') if p.endswith('.md')]
for path in prior:
    assert (ROOT / path).read_bytes() == git('show', '597e7cf:' + path), path
ideas = 'ARTICLE_IDEAS_2026-09.md'
strip_progress = lambda value: re.sub(r'\n<!-- production-progress:start -->[\s\S]*?<!-- production-progress:end -->\n?', '', value)
assert strip_progress((ROOT / ideas).read_text()) == git('show', '8a1bfa8:' + ideas).decode()
guard = {'baseline': '8a1bfa8', 'beforeBatch': '597e7cf', 'baselineFilesUnchanged': len(baseline), 'previousArticleFilesUnchanged': len(prior), 'humanizerFinalHashesMatched': 12, 'originalIdeaContentUnchanged': True, 'exception': 'ARTICLE_IDEAS_2026-09.md production progress block only'}
(OUT / 'repository-guard.json').write_text(json.dumps(guard, indent=2) + '\n')
report = {'articleSnippets': snippets, 'usingCases': 9, 'executedUsingArticleExamples': 2, 'sqliteCases': 4, 'proxyHttpCases': 7, 'runtimeApiCases': 6, 'proxyInvalidRuntimeCase': 1, 'sameBuildEnvironments': 2, 'browserImages': 5, 'guard': guard}
(OUT / 'snippet-verification.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({'snippets': len(snippets), **{k: v for k, v in report.items() if k != 'articleSnippets'}}, indent=2))
