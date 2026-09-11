"""Fault-inject the unmodified official CE restore script through a local Docker shim.

This tests CLI control flow, never a Plane instance or a Docker volume. The shim
does not contact a daemon. Archive names are fixtures, not real volume backups.
"""
import hashlib, json, os, pathlib, subprocess, tempfile, urllib.request
ROOT=pathlib.Path(__file__).resolve().parents[2]
OUT=ROOT/'production/2026-09/batch-07'
REF=json.loads((OUT/'plane-source-ref.json').read_text())['commit']
URL=f'https://raw.githubusercontent.com/makeplane/plane/{REF}/deployments/cli/community/restore.sh'
source=urllib.request.urlopen(URL).read()
shim='''#!/usr/bin/env python3
import json,os,pathlib,sys
args=sys.argv[1:]
with open(os.environ['ARTICLE_CALL_LOG'],'a') as f: f.write(json.dumps(args)+'\\n')
volumes=['pgdata','redisdata','uploads','rabbitmq_data']
if os.environ['ARTICLE_CASE']=='missing-volume': volumes.remove('uploads')
if pathlib.Path(sys.argv[0]).name=='docker-compose': print('[{"Status":"exited"}]')
elif args[:2]==['volume','ls']:
 pattern=next(x[5:] for x in args if x.startswith('name='))
 print('\\n'.join('plane-app_'+x for x in volumes if pattern in 'plane-app_'+x))
elif args[:2] in [['volume','rm'],['volume','create']]: pass
elif args and args[0]=='run':
 if os.environ['ARTICLE_CASE']=='restore-error' and 'TAR_NAME=uploads' in args: sys.exit(1)
else: raise SystemExit('Unexpected command: '+str(args))
'''
records=[]
for case in ['all-archives','missing-archive','missing-volume','restore-error']:
    with tempfile.TemporaryDirectory(prefix='article-plane-cli-') as tmp:
        p=pathlib.Path(tmp); bin=p/'bin';bin.mkdir();backups=p/'backup';backups.mkdir()
        for name in ['docker','docker-compose']:
            (bin/name).write_text(shim);(bin/name).chmod(0o755)
        (bin/'clear').write_text('#!/bin/sh\nexit 0\n');(bin/'clear').chmod(0o755)
        for v in ['pgdata','redisdata','uploads','rabbitmq_data']:
            if case=='missing-archive' and v=='uploads': continue
            (backups/(v+'.tar.gz')).write_bytes(b'fixture, not a real archive')
        script=p/'restore.sh';script.write_bytes(source)
        call_log=p/'calls.jsonl'
        env={**os.environ,'PATH':str(bin)+os.pathsep+os.environ['PATH'],'ARTICLE_CASE':case,'ARTICLE_CALL_LOG':str(call_log)}
        r=subprocess.run(['bash',str(script),str(backups)],cwd=p,env=env,capture_output=True,text=True)
        calls=[json.loads(x) for x in call_log.read_text().splitlines()]
        attempts=[next(x for x in c if x.startswith('TAR_NAME='))[9:] for c in calls if c[0]=='run']
        record={'case':case,'exitCode':r.returncode,'attempts':attempts,'successMessage':'Restore completed successfully.' in r.stdout,'output':r.stdout.replace(str(p),'<scratch>'),'stderr':r.stderr}
        assert r.returncode==0 and record['successMessage'],record
        assert len(attempts)==(3 if case in ['missing-archive','missing-volume'] else 4)
        if case=='restore-error': assert 'Error: Failed to restore volume' in r.stdout
        if case=='missing-volume': assert 'Skipping: No volume found' in r.stdout
        records.append(record)
result={'url':URL,'sha256':hashlib.sha256(source).hexdigest(),'commit':REF,'scope':'exact official shell script with fake Docker commands; CLI branching only, not database or file restoration','cases':records}
(OUT/'plane-restore-cli.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps([{k:r[k] for k in ['case','exitCode','attempts','successMessage']} for r in records]))
