"""Run selected real tests from fixed personal-repository commits in scratch copies."""
from pathlib import Path
import io, json, os, subprocess, tarfile, tempfile

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'production/2026-09/batch-05'
TARGETS = [
    ('push', 'circle-hub-multi-device-push', '0cda1e865ad80d1529197729d8d436e96d56edc7', [
        'src/security/push-token-privacy.test.ts', 'src/security/article-push-rollout.test.ts']),
    ('auth', 'circle-hub-auth-recovery', 'd116e8a343e8d9e7ddd3d1985efe590fa1901868', [
        'src/server/auth/auth-core-recovery.test.ts', 'src/server/auth/diagnostics.test.ts',
        'src/server/auth/diagnostic-route.test.ts', 'src/server/auth/diagnostic-notification.test.ts',
        'src/server/auth/redirect.test.ts', 'src/app/sign-in/submission-guard.test.ts',
        'src/app/sign-in/oauth-actions.test.ts', 'src/app/sign-in/error/error-copy.test.ts']),
    ('guest', 'circle-hub-growth-06-guest-identity', '9aec48963842dcaf16ce49c80317366509ab1b8f', [
        'src/server/api/lib/guest-response-ownership.test.ts',
        'src/server/api/routers/guest-response-security.test.ts',
        'src/lib/guest-response-store.test.ts']),
]

reports = []
for label, name, commit, tests in TARGETS:
    repo = ROOT.parent / name
    with tempfile.TemporaryDirectory(prefix=f'article-{label}-tests-') as tmp:
        scratch = Path(tmp)
        archive = subprocess.check_output(['git', '-C', str(repo), 'archive', commit,
            'apps/web', 'packages', 'package.json', 'pnpm-workspace.yaml'])
        with tarfile.open(fileobj=io.BytesIO(archive)) as tar:
            tar.extractall(scratch, filter='data')
        (scratch / 'node_modules').symlink_to(repo / 'node_modules', target_is_directory=True)
        web = scratch / 'apps/web'
        (web / 'node_modules').symlink_to(repo / 'apps/web/node_modules', target_is_directory=True)
        # Keep Vitest/Vite's cache in the disposable copy, not the linked dependencies.
        config = web / 'vitest.config.ts'
        text = config.read_text().replace('export default defineConfig({',
            'export default defineConfig({\n  cacheDir: "./article-test-cache",')
        config.write_text(text)
        if label == 'push':
            old = subprocess.check_output(['git', '-C', str(repo), 'show',
                'ad0a669^:apps/web/src/server/api/routers/notification.ts'], text=True)
            (web / 'src/server/api/routers/notification-before-multi.ts').write_text(old)
            source = ROOT / 'experiments/article-stock-2026-09/push-rollout.test.ts'
            (web / 'src/security/article-push-rollout.test.ts').write_text(source.read_text())
        version_script = '''
import {createRequire} from 'node:module';
const r=createRequire(process.cwd()+'/package.json');
const pkgs=['vitest','next','next-auth','@libsql/client','drizzle-orm'];
const out={node:process.version};
for(const p of pkgs){try{out[p]=r(p+'/package.json').version;}catch{}}
const auth=createRequire(r.resolve('next-auth'));
const fs=await import('node:fs'),path=await import('node:path');
out['@auth/core']=JSON.parse(fs.readFileSync(path.join(path.dirname(auth.resolve('@auth/core')),'package.json'),'utf8')).version;
console.log(JSON.stringify(out));
'''
        versions = json.loads(subprocess.check_output(['node', '--input-type=module', '-e', version_script], cwd=web, text=True))
        result_file = OUT / f'{label}-tests.json'
        cmd = [str(web / 'node_modules/.bin/vitest'), 'run', '--config', 'vitest.config.ts',
            *tests, '--reporter=json', f'--outputFile={result_file}']
        result = subprocess.run(cmd, cwd=web, env={**os.environ, 'SKIP_ENV_VALIDATION': '1'}, capture_output=True, text=True)
        (OUT / f'{label}-tests.log').write_text((result.stdout + result.stderr).rstrip() + '\n')
        raw = json.loads(result_file.read_text())
        # Replace temporary absolute source paths with paths relative to the fixed checkout.
        result_file.write_text(json.dumps(raw, ensure_ascii=False, indent=2).replace(str(web.resolve()), 'apps/web').replace(str(web), 'apps/web') + '\n')
        report = {'label': label, 'repository': name, 'commit': commit, 'versions': versions,
            'exitCode': result.returncode, 'tests': raw['numTotalTests'], 'passed': raw['numPassedTests'],
            'failed': raw['numFailedTests'], 'success': raw['success'], 'selectedFiles': tests}
        reports.append(report)
        print(json.dumps(report, ensure_ascii=False), flush=True)
        if result.returncode or not raw['success']:
            raise RuntimeError(f'{label} tests failed; see saved log')
OUT.joinpath('circle-tests-summary.json').write_text(json.dumps(reports, ensure_ascii=False, indent=2) + '\n')
