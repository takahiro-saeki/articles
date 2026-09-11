"""Read fixed personal Git objects; store hashes and narrowly checked facts only."""
import hashlib,json,pathlib,re,subprocess
ROOT=pathlib.Path(__file__).resolve().parents[2]
REPOS=ROOT.parent
SOURCES={
 'squadnote':('circle-hub-auth-recovery','d116e8a343e8d9e7ddd3d1985efe590fa1901868'),
 'voices':('voice-training-log','6143bb99873ccf04b134dad4ac6b12c6e7a02d48'),
 'instagram':('circle-hub-sqn-47-instagram-01','e295f5cedf9f8989b36c9f308dee4dbd8cf64c3f'),
}
read_files=[]
def read(key,path):
 repo,rev=SOURCES[key]
 data=subprocess.check_output(['git','-C',str(REPOS/repo),'show',rev+':'+path])
 read_files.append({'source':key,'path':path,'sha256':hashlib.sha256(data).hexdigest()})
 return data.decode()
configs={}
for key in ['squadnote','voices']:
 config=read(key,'apps/mobile/app.config.ts')
 eas=json.loads(read(key,'apps/mobile/eas.json'))
 configs[key]={
  'version':re.search(r'\bversion: "([^"]+)"',config)[1],
  'runtimePolicy':re.search(r'runtimeVersion:\s*\{\s*policy: "([^"]+)"',config)[1],
  'buildProfiles':{name:{'distribution':v.get('distribution'),'channel':v.get('channel'),'apiOrigin':v.get('env',{}).get('EXPO_PUBLIC_API_URL')} for name,v in eas['build'].items()},
 }
assert configs['squadnote']['runtimePolicy']=='appVersion'
assert configs['voices']['runtimePolicy']=='fingerprint'
assert configs['squadnote']['buildProfiles']['preview']['distribution']=='internal'
assert configs['voices']['buildProfiles']['preview']['distribution']=='store'
assert configs['squadnote']['buildProfiles']['preview']['apiOrigin']=='https://squad-note.com'
assert configs['voices']['buildProfiles']['preview']['apiOrigin']=='https://voicesdiary.com'
voice_readme=read('voices','README.md')
assert '実装は未着手' in voice_readme
voice_login=read('voices','apps/mobile/src/app/login.tsx')
assert 'waitForNativeModalToSettle' in voice_login and 'IOS_MODAL_SETTLE_MS = 350' in voice_login
voice_notifications=read('voices','apps/mobile/src/lib/notifications.ts')
assert 'SchedulableTriggerInputTypes.WEEKLY' in voice_notifications
assert 'SecureStore.setItemAsync' in voice_notifications
voice_router=read('voices','apps/web/src/server/api/routers/notification.ts')
assert 'PUSH_TEST_ADMIN_EMAILS' in voice_router
for path in ['docs/15-notification-reminders.md','docs/16-retention-social-roadmap.md','docs/17-remote-notification-test.md','docs/10-testflight-runbook.md']:
 read('voices',path)
for path in ['docs/multi-device-push.md','apps/web/src/server/api/routers/notification.ts','apps/web/src/server/api/lib/notify.ts','docs/testing/sqn-30-trial-participant-checklist.md']:
 read('squadnote',path)
prefix='docs/marketing/instagram/001-invite-join/'
static=read('instagram',prefix+'README.md')
video=read('instagram',prefix+'video/README.md')
publication=read('instagram',prefix+'video/publication-check.md')
assert '/browse/SQN-47' in static and '/browse/SQN-48' in video
assert '有料の公開音声は未生成' in publication
read('instagram','docs/marketing/instagram/README.md')
result={'checkedOn':'2026-09-11','sources':{k:{'repository':r,'commit':v} for k,(r,v) in SOURCES.items()},'configs':configs,'files':read_files,'limits':['Static source and configuration inspection only','No evaluation of production deployments or installed native binaries','README and historical checklist status are not a current release inventory','No notification or authentication requests were sent']}
(ROOT/'production/2026-09/batch-06/repository-evidence.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'files':len(read_files),'configs':configs},ensure_ascii=False))
