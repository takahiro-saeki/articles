import {mkdtempSync,readFileSync,writeFileSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const repo=resolve(process.argv[2]??'../circle-hub-multi-device-push');
const ref='0cda1e865ad80d1529197729d8d436e96d56edc7';
const scratch=mkdtempSync(join(tmpdir(),'article-next-entry-'));
const archive=execFileSync('git',['-C',repo,'archive',ref,'apps/web/src','apps/web/vitest.config.ts','apps/web/package.json'],{maxBuffer:32*1024*1024});
execFileSync('tar',['-x','-C',scratch],{input:archive});
const web=join(scratch,'apps/web');
symlinkSync(join(repo,'apps/web/node_modules'),join(web,'node_modules'),'dir');
writeFileSync(join(web,'src/security/article-route-entry.test.ts'),`
import {afterEach,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({getDb:vi.fn(),sendPush:vi.fn()}));
vi.mock('~/server/db',()=>({getDb:mocks.getDb}));
vi.mock('~/server/api/lib/expo-push',()=>({sendPushToUsers:mocks.sendPush}));
import {POST} from '~/app/api/cron/morning-reminder/route';
afterEach(()=>{vi.unstubAllEnvs();vi.clearAllMocks();vi.restoreAllMocks();});
it('missing configuration returns 500 before DB access',async()=>{
  vi.stubEnv('CRON_SECRET','');vi.spyOn(console,'error').mockImplementation(()=>{});
  const response=await POST(new Request('https://localhost/api/cron/morning-reminder',{method:'POST'}));
  expect(response.status).toBe(500);expect(mocks.getDb).not.toHaveBeenCalled();expect(mocks.sendPush).not.toHaveBeenCalled();
});
it.each([undefined,'Bearer wrong-fixture-secret'])('invalid credentials return 401 before DB access: %s',async authorization=>{
  vi.stubEnv('CRON_SECRET','local-fixture-secret');
  const response=await POST(new Request('https://localhost/api/cron/morning-reminder',{method:'POST',headers:authorization?{authorization}:{}}));
  expect(response.status).toBe(401);expect(mocks.getDb).not.toHaveBeenCalled();expect(mocks.sendPush).not.toHaveBeenCalled();
});
it('valid credentials reach the mocked empty schedule query',async()=>{
  vi.stubEnv('CRON_SECRET','local-fixture-secret');
  const where=vi.fn().mockResolvedValue([]);
  mocks.getDb.mockReturnValue({select:()=>({from:()=>({where})})});
  const response=await POST(new Request('https://localhost/api/cron/morning-reminder',{method:'POST',headers:{authorization:'Bearer local-fixture-secret'}}));
  expect(response.status).toBe(200);expect(await response.json()).toMatchObject({schedules:0,recipients:0});
  expect(mocks.getDb).toHaveBeenCalledTimes(1);expect(where).toHaveBeenCalledTimes(1);expect(mocks.sendPush).not.toHaveBeenCalled();
});
`);
const report=join(scratch,'report.json');
const run=spawnSync(process.execPath,[join(web,'node_modules/vitest/vitest.mjs'),'run','src/security/article-route-entry.test.ts','--reporter=json',`--outputFile=${report}`],{cwd:web,env:{...process.env,SKIP_ENV_VALIDATION:'1',CRON_SECRET:''},encoding:'utf8'});
const result=JSON.parse(readFileSync(report,'utf8'));
assert.equal(run.status,0,run.stdout+run.stderr+JSON.stringify(result));assert.equal(result.numPassedTests,4);
console.log(JSON.stringify({ref,node:process.version,next:JSON.parse(readFileSync(join(web,'node_modules/next/package.json'),'utf8')).version,vitest:JSON.parse(readFileSync(join(web,'node_modules/vitest/package.json'),'utf8')).version,scope:'Direct invocation of archived real POST handler; mocked DB and push; local env fallback; no Next HTTP server, Server Action transport, Cloudflare binding, or external requests',passed:result.numPassedTests,tests:result.testResults.flatMap(x=>x.assertionResults.map(x=>({title:x.title,status:x.status})))},null,2));
