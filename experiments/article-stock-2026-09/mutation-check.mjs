import {mkdtempSync,readFileSync,writeFileSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const repo=resolve(process.argv[2]??'../circle-hub-multi-device-push');
const ref='0cda1e865ad80d1529197729d8d436e96d56edc7';
const scratch=mkdtempSync(join(tmpdir(),'article-router-mutation-'));
const archive=execFileSync('git',['-C',repo,'archive',ref,'apps/web/src','apps/web/vitest.config.ts','apps/web/package.json'],{maxBuffer:32*1024*1024});
execFileSync('tar',['-x','-C',scratch],{input:archive});
const web=join(scratch,'apps/web');
symlinkSync(join(repo,'apps/web/node_modules'),join(web,'node_modules'),'dir');
function test(name){
 const report=join(scratch,`${name}.json`);
 const run=spawnSync(process.execPath,[join(web,'node_modules/vitest/vitest.mjs'),'run','src/security/push-token-privacy.test.ts','--reporter=json',`--outputFile=${report}`],{cwd:web,env:{...process.env,SKIP_ENV_VALIDATION:'1'},encoding:'utf8'});
 assert(readFileSync(report,'utf8'),run.stderr);
 const result=JSON.parse(readFileSync(report,'utf8'));
 return {exitCode:run.status,passed:result.numPassedTests,failed:result.numFailedTests,failures:result.testResults.flatMap(x=>x.assertionResults.filter(x=>x.status==='failed').map(x=>({title:x.title,message:x.failureMessages.join('\n')})))};
}
const baseline=test('baseline');assert.equal(baseline.exitCode,0);assert.equal(baseline.passed,8);
const path=join(web,'src/server/api/routers/notification.ts');
const original=readFileSync(path,'utf8');
const before=`and(
            eq(pushTokens.userId, ctx.session.user.id),
            eq(pushTokens.token, input.token),
          )`;
assert.equal(original.split(before).length,2);
writeFileSync(path,original.replace(before,'eq(pushTokens.token, input.token)'));
const mutated=test('mutated');assert.equal(mutated.exitCode,1);assert.equal(mutated.failed,1);
assert(mutated.failures[0].title.includes('旧ユーザーは削除できない'));
console.log(JSON.stringify({ref,node:process.version,vitest:JSON.parse(readFileSync(join(web,'node_modules/vitest/package.json'),'utf8')).version,scope:'archived source copy; real router + libSQL; existing external HTTP mocks; original repository not changed',mutation:'Remove only the userId condition from token deregistration',baseline,mutated},null,2));
