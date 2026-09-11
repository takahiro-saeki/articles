import {createRequire} from 'node:module';
import {mkdtempSync,writeFileSync,realpathSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';
const wranglerPackage=realpathSync(resolve(process.argv[2]??'../circle-hub-multi-device-push/apps/web/node_modules/wrangler/package.json'));
const require=createRequire(wranglerPackage);
const {getPlatformProxy}=require('./');
const scratch=mkdtempSync(join(tmpdir(),'article-d1-batch-'));
const configPath=join(scratch,'wrangler.jsonc');
writeFileSync(configPath,JSON.stringify({name:'article-d1-batch-lab',compatibility_date:'2026-09-11',compatibility_flags:['nodejs_compat'],d1_databases:[{binding:'DB',database_name:'article-d1-batch-lab',database_id:'00000000-0000-0000-0000-000000000000',remote:false}]}));
const platform=await getPlatformProxy({configPath,persist:false,remoteBindings:false});
try{
 const db=platform.env.DB;
 await db.exec('CREATE TABLE stock (id INTEGER PRIMARY KEY, remaining INTEGER NOT NULL CHECK (remaining >= 0));\nCREATE TABLE orders (id TEXT PRIMARY KEY, quantity INTEGER NOT NULL);');
 async function reset(){await db.batch([db.prepare('DELETE FROM orders'),db.prepare('DELETE FROM stock'),db.prepare('INSERT INTO stock VALUES (1, 1)')]);}
 async function state(){return {remaining:(await db.prepare('SELECT remaining FROM stock WHERE id = 1').first()).remaining,orders:(await db.prepare('SELECT id, quantity FROM orders ORDER BY id').all()).results};}
 const cases=[];
 await reset();
 const success=await db.batch([
  db.prepare('UPDATE stock SET remaining = remaining - ? WHERE id = 1 AND remaining >= ?').bind(1,1),
  db.prepare('INSERT INTO orders (id, quantity) VALUES (?, ?)').bind('order-a',1),
  db.prepare('SELECT remaining FROM stock WHERE id = 1'),
 ]);
 const successfulState=await state();assert.equal(success[0].meta.changes,1);assert.deepEqual(success[2].results,[{remaining:0}]);assert.deepEqual(successfulState,{remaining:0,orders:[{id:'order-a',quantity:1}]});
 cases.push({name:'success and sequential visibility',changes:success.map(x=>x.meta.changes),thirdResult:success[2].results,state:successfulState});
 await reset();await db.prepare('INSERT INTO orders VALUES (?, ?)').bind('duplicate',1).run();
 let uniqueError='';try{await db.batch([
  db.prepare('UPDATE stock SET remaining = remaining - 1 WHERE id = 1'),
  db.prepare('INSERT INTO orders VALUES (?, ?)').bind('duplicate',1),
 ]);}catch(e){uniqueError=e.message;}
 assert.match(uniqueError,/UNIQUE constraint failed/);
 const uniqueState=await state();assert.deepEqual(uniqueState,{remaining:1,orders:[{id:'duplicate',quantity:1}]});
 cases.push({name:'unique violation rolls back earlier update',error:uniqueError,state:uniqueState});
 await reset();
 const zero=await db.batch([
  db.prepare('UPDATE stock SET remaining = remaining - ? WHERE id = 1 AND remaining >= ?').bind(2,2),
  db.prepare('INSERT INTO orders (id, quantity) VALUES (?, ?)').bind('order-b',2),
 ]);
 assert.equal(zero[0].meta.changes,0);assert.equal(zero[1].meta.changes,1);
 let postBatchError='';try{if(zero[0].meta.changes!==1)throw new Error('No stock was reserved');}catch(e){postBatchError=e.message;}
 const zeroState=await state();assert.deepEqual(zeroState,{remaining:1,orders:[{id:'order-b',quantity:2}]});
 cases.push({name:'zero affected rows and later JS throw do not roll back',changes:zero.map(x=>x.meta.changes),postBatchError,state:zeroState});
 await reset();
 let checkError='';try{await db.batch([
  db.prepare('UPDATE stock SET remaining = remaining - ? WHERE id = 1').bind(2),
  db.prepare('INSERT INTO orders (id, quantity) VALUES (?, ?)').bind('order-c',2),
 ]);}catch(e){checkError=e.message;}
 assert.match(checkError,/CHECK constraint failed/);
 const checkState=await state();assert.deepEqual(checkState,{remaining:1,orders:[]});
 cases.push({name:'CHECK constraint rejects negative remaining stock',error:checkError,state:checkState});
 console.log(JSON.stringify({node:process.version,wrangler:require('./package.json').version,miniflare:require('miniflare/package.json').version,compatibilityDateRequested:'2026-09-11',scope:'Local D1 proxy only, in-memory persistence, synthetic schema; no remote bindings or deployment',cases},null,2));
}finally{await platform.dispose();}
