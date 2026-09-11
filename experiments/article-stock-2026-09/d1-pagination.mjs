import {createRequire} from 'node:module';
import {mkdtempSync,writeFileSync,realpathSync,rmSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir,cpus,platform as osPlatform,arch} from 'node:os';
import {performance} from 'node:perf_hooks';
import assert from 'node:assert/strict';
const wranglerPackage=realpathSync(resolve(process.argv[2]??'../circle-hub-multi-device-push/apps/web/node_modules/wrangler/package.json'));
const require=createRequire(wranglerPackage),{getPlatformProxy}=require('./');
const scratch=mkdtempSync(join(tmpdir(),'article-d1-pagination-'));
const configPath=join(scratch,'wrangler.jsonc');
writeFileSync(configPath,JSON.stringify({name:'article-pagination-lab',compatibility_date:'2026-09-11',d1_databases:[{binding:'DB',database_name:'article-pagination-lab',database_id:'00000000-0000-0000-0000-000000000000',remote:false}]}));
const proxy=await getPlatformProxy({configPath,persist:false,remoteBindings:false});
try{
 const db=proxy.env.DB;
 await db.exec('CREATE TABLE notification (id INTEGER PRIMARY KEY, user_id TEXT NOT NULL, created_at INTEGER NOT NULL);\nCREATE INDEX idx_feed ON notification(user_id, created_at DESC, id DESC);');
 await db.prepare(`WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n < 100000)
 INSERT INTO notification SELECT n, 'user-a', CAST(n/3 AS INTEGER) FROM seq`).run();
 assert.equal(await db.prepare('SELECT COUNT(*) FROM notification').first('COUNT(*)'),100000);
 const offsetSQL='SELECT id, created_at FROM notification WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 20 OFFSET ?';
 const cursorSQL='SELECT id, created_at FROM notification WHERE user_id = ? AND (created_at, id) < (?, ?) ORDER BY created_at DESC, id DESC LIMIT 20';
 const sample=(arr)=>({min:Math.min(...arr),median:[...arr].sort((a,b)=>a-b)[Math.floor(arr.length/2)],max:Math.max(...arr)});
 const results=[];
 for(const offset of [20,1000,10000,50000,99000]){
  const prev=await db.prepare('SELECT id, created_at FROM notification WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 1 OFFSET ?').bind('user-a',offset-1).first();
  const statements={offset:db.prepare(offsetSQL).bind('user-a',offset),cursor:db.prepare(cursorSQL).bind('user-a',prev.created_at,prev.id)};
  const reference=(await statements.offset.all()).results;
  assert.deepEqual((await statements.cursor.all()).results,reference);
  const timings={offset:[],cursor:[]},last={};
  for(let round=0;round<15;round++){
   for(const name of (round%2?['cursor','offset']:['offset','cursor'])){
    const start=performance.now(),r=await statements[name].all(),elapsed=performance.now()-start;
    assert.deepEqual(r.results,reference);last[name]=r.meta;
    if(round>=4)timings[name].push(elapsed);
   }
  }
  const plans={offset:(await db.prepare('EXPLAIN QUERY PLAN '+offsetSQL).bind('user-a',offset).all()).results,cursor:(await db.prepare('EXPLAIN QUERY PLAN '+cursorSQL).bind('user-a',prev.created_at,prev.id).all()).results};
  results.push({offset,cursor:prev,ids:reference.map(r=>r.id),wall_ms:{offset:sample(timings.offset),cursor:sample(timings.cursor)},raw_wall_ms:timings,last_meta:last,plans});
 }
 const first=(await db.prepare('SELECT id, created_at FROM notification WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 20').bind('user-a').all()).results;
 const boundary=first.at(-1);
 await db.prepare("INSERT INTO notification VALUES (100001, 'user-a', 99999)").run();
 const offsetAfter=(await db.prepare(offsetSQL).bind('user-a',20).all()).results;
 const cursorAfter=(await db.prepare(cursorSQL).bind('user-a',boundary.created_at,boundary.id).all()).results;
 assert.equal(offsetAfter[0].id,boundary.id);assert(!cursorAfter.some(r=>first.some(x=>x.id===r.id)));
 console.log(JSON.stringify({node:process.version,wrangler:require('./package.json').version,miniflare:require('miniflare/package.json').version,os:osPlatform(),arch:arch(),cpu:cpus()[0]?.model,compatibilityDateRequested:'2026-09-11',scope:'Local D1 only; 100000 synthetic rows; no cloud latency or billing measurements',queries:{offsetSQL,cursorSQL},measurement:'4 warmup rounds then 11 measured rounds, alternating query order. Cursor acquisition and result assertions excluded from timings; local proxy overhead included.',results,insert_between_pages:{firstPageLastID:boundary.id,offsetNextFirstID:offsetAfter[0].id,cursorNextFirstID:cursorAfter[0].id,offsetDuplicate:true,cursorDuplicate:false}},null,2));
}finally{await proxy.dispose();rmSync(scratch,{recursive:true,force:true});}
