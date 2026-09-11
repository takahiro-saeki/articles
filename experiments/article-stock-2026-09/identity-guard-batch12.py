"""Run the installed hook and a proposed read-only check with fake gh/git tools."""
import hashlib,json,os,shutil,subprocess,tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'production/2026-09/batch-12'
hook=Path('/Users/takahiro_saeki/.Codex/hooks/check-github-account.sh')
raw=hook.read_bytes()
check='''expected_account=takahiro-saeki
expected_remote=https://github.com/takahiro-saeki/articles.git
actual_account=$(gh api user --jq .login) || exit 1
[ "$actual_account" = "$expected_account" ] || exit 1
actual_remote=$(git remote get-url --push origin) || exit 1
[ "$actual_remote" = "$expected_remote" ] || exit 1
printf '%s\\n' 'identity and destination verified'
'''
(OUT/'read-only-identity-check.sh').write_text(check)
with tempfile.TemporaryDirectory(prefix='article-identity-') as td:
    tmp=Path(td)
    for name,body in {
        'gh':'#!/bin/sh\n[ "$MOCK_FAIL_GH" = 1 ] && exit 1\nprintf "%s\\n" "$MOCK_LOGIN"\n',
        'git':'#!/bin/sh\nprintf "%s\\n" "$MOCK_REMOTE"\n',
    }.items():
        p=tmp/name;p.write_text(body);p.chmod(0o755)
    cases=[
        ('personal identity matches','takahiro-saeki',False,'https://github.com/takahiro-saeki/articles.git','git push origin article-draft',False,True),
        ('company credential in personal directory','tsaeki-ai-model',False,'https://github.com/takahiro-saeki/articles.git','git push origin article-draft',True,False),
        ('identity request fails','',True,'https://github.com/takahiro-saeki/articles.git','git push origin article-draft',False,False),
        ('company remote','takahiro-saeki',False,'https://github.com/tsaeki-ai-model/articles.git','git push origin article-draft',True,False),
        ('different personal repository','takahiro-saeki',False,'https://github.com/takahiro-saeki/another.git','git push origin article-draft',False,False),
        ('read-only command is outside hook scope','tsaeki-ai-model',False,'https://github.com/takahiro-saeki/articles.git','git status --short',False,False),
    ]
    results=[]
    for name,login,fail,remote,command,deny_expected,check_expected in cases:
        # Do not inherit real authentication variables. The hook never executes command text.
        env={'PATH':str(tmp)+':/opt/homebrew/bin:/usr/bin:/bin','HOME':str(Path.home()),'MOCK_LOGIN':login,'MOCK_FAIL_GH':str(int(fail)),'MOCK_REMOTE':remote}
        result=subprocess.run(['/bin/bash',str(hook)],input=json.dumps({'cwd':str(ROOT),'tool_input':{'command':command}}),text=True,capture_output=True,env=env,check=True)
        decision=json.loads(result.stdout)['hookSpecificOutput']['permissionDecision'] if result.stdout.strip() else 'no denial'
        assert (decision=='deny')==deny_expected,(name,result.stdout)
        check_result=subprocess.run(['/bin/sh',str(OUT/'read-only-identity-check.sh')],text=True,capture_output=True,env=env)
        assert (check_result.returncode==0)==check_expected,name
        results.append({'case':name,'installedHook':decision,'proposedCheckExit':check_result.returncode})
report={'hookPath':str(hook),'hookSha256':hashlib.sha256(raw).hexdigest(),'checkedOn':'2026-09-11','mode':'read-only hook process with fake gh/git, no real authentication, no pushes, no hook edits','results':results,'cases':len(results),'hookRegistrationVerified':False}
assert raw==hook.read_bytes()
(OUT/'identity-experiment.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False,indent=2))
