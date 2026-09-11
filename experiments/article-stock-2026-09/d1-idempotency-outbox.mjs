import {createRequire} from 'node:module';
import {mkdtempSync,writeFileSync,realpathSync,rmSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash,randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
const wranglerPackage=realpathSync(resolve(process.argv[2]??'../circle-hub-multi-device-push/apps/web/node_modules/wrangler/package.json'));
const require=createRequire(wranglerPackage),{getPlatformProxy}=require('./');
const scratch=mkdtempSync(join(tmpdir(),'article-d1-retry-'));
const configPath=join(scratch,'wrangler.jsonc');
writeFileSync(configPath,JSON.stringify({name:'article-retry-lab',compatibility_date:'2026-09-11',d1_databases:[{binding:'DB',database_name:'article-retry-lab',database_id:'00000000-0000-0000-0000-000000000000',remote:false}]}));
const proxy=await getPlatformProxy({configPath,persist:false,remoteBindings:false});
try{
 const db=proxy.env.DB;
 await db.exec(`CREATE TABLE note (id TEXT PRIMARY KEY, actor TEXT NOT NULL, title TEXT NOT NULL CHECK (title <> 'reject-write'));
CREATE TABLE request_result (actor TEXT NOT NULL, operation TEXT NOT NULL, request_key TEXT NOT NULL, fingerprint TEXT NOT NULL, status_code INTEGER NOT NULL, body TEXT NOT NULL, PRIMARY KEY(actor, operation, request_key));
CREATE TABLE outbox (event_id TEXT PRIMARY KEY, note_id TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind = 'note.created'), payload TEXT NOT NULL, sent INTEGER NOT NULL DEFAULT 0);`);
 const count=table=>db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first('n');
 const reset=()=>db.batch(['outbox','request_result','note'].map(t=>db.prepare(`DELETE FROM ${t}`)));
 async function createNote(actor,key,title,{afterMiss}={}){
  const operation='create-note:v1',fingerprint=createHash('sha256').update(JSON.stringify({title})).digest('hex');
  const lookup=()=>db.prepare('SELECT fingerprint, status_code, body FROM request_result WHERE actor=? AND operation=? AND request_key=?').bind(actor,operation,key).first();
  const replay=row=>{if(row.fingerprint!==fingerprint)throw Object.assign(new Error('Key reused with different input'),{status:409});return {status:row.status_code,body:JSON.parse(row.body),replayed:true};};
  const existing=await lookup();if(existing)return replay(existing);
  if(afterMiss)await afterMiss();
  const body={id:randomUUID(),title};
  try{
   await db.batch([
    db.prepare('INSERT INTO request_result VALUES (?, ?, ?, ?, ?, ?)').bind(actor,operation,key,fingerprint,201,JSON.stringify(body)),
    db.prepare('INSERT INTO note VALUES (?, ?, ?)').bind(body.id,actor,title),
   ]);
  }catch(error){const raced=await lookup();if(raced)return replay(raced);throw error;}
  return {status:201,body,replayed:false};
 }
 const idempotency=[];
 await reset();
 let original;
 await assert.rejects(async()=>{original=await createNote('actor-a','key-a','hello');throw new Error('simulated response loss after commit');},/response loss/);
 const retried=await createNote('actor-a','key-a','hello');assert.deepEqual(retried.body,original.body);assert.equal(retried.status,original.status);assert.equal(await count('note'),1);
 idempotency.push({name:'response lost after commit',notes:1,same_body:true,status:retried.status,replayed:retried.replayed});
 await assert.rejects(createNote('actor-a','key-a','different'),e=>e.status===409);assert.equal(await count('note'),1);
 idempotency.push({name:'same key with different input',status:409,notes:1});
 await createNote('actor-b','key-a','hello');assert.equal(await count('note'),2);
 idempotency.push({name:'same key for another actor',notes:2});
 await reset();let misses=0,release;const barrier=new Promise(r=>release=r);
 const afterMiss=async()=>{if(++misses===2)release();await barrier;};
 const concurrent=await Promise.all([createNote('actor-a','race','hello',{afterMiss}),createNote('actor-a','race','hello',{afterMiss})]);
 assert.equal(misses,2);assert.deepEqual(concurrent[0].body,concurrent[1].body);assert.equal(await count('note'),1);assert.deepEqual(concurrent.map(x=>x.replayed).sort(),[false,true]);
 idempotency.push({name:'two concurrent cache misses',misses,notes:1,same_body:true,replay_flags:concurrent.map(x=>x.replayed)});
 await reset();await assert.rejects(createNote('actor-a','bad','reject-write'),/CHECK constraint failed/);assert.equal(await count('note'),0);assert.equal(await count('request_result'),0);
 idempotency.push({name:'business insert fails',notes:0,saved_results:0});
 await createNote('actor-a','expired','hello');await db.prepare('DELETE FROM request_result WHERE request_key=?').bind('expired').run();await createNote('actor-a','expired','hello');assert.equal(await count('note'),2);
 idempotency.push({name:'record deleted to simulate retention expiry',notes:2});
 async function createWithOutbox(id,kind='note.created'){
  const payload=JSON.stringify({noteId:id,title:'hello'});
  await db.batch([
   db.prepare('INSERT INTO note VALUES (?, ?, ?)').bind(id,'actor-a','hello'),
   db.prepare('INSERT INTO outbox(event_id,note_id,kind,payload) VALUES (?, ?, ?, ?)').bind('event-'+id,id,kind,payload),
  ]);
 }
 class FakeProvider{
  attempts=0;deliveries=[];seen=new Map();
  constructor(deduplicate){this.deduplicate=deduplicate;}
  async send(key,payload){this.attempts++;if(this.deduplicate&&this.seen.has(key)){assert.equal(this.seen.get(key),payload);return;}this.seen.set(key,payload);this.deliveries.push({key,payload});}
 }
 async function consumeOne(provider,{crashAfterSend=false}={}){
  const event=await db.prepare('SELECT event_id,payload FROM outbox WHERE sent=0 ORDER BY event_id LIMIT 1').first();
  if(!event)return false;
  await provider.send(event.event_id,event.payload);
  if(crashAfterSend)throw new Error('simulated consumer crash after provider success');
  await db.prepare('UPDATE outbox SET sent=1 WHERE event_id=?').bind(event.event_id).run();
  return true;
 }
 const outbox=[];
 await reset();await assert.rejects(createWithOutbox('rollback','bad-kind'),/CHECK constraint failed/);assert.equal(await count('note'),0);assert.equal(await count('outbox'),0);
 outbox.push({name:'outbox constraint failure',notes:0,events:0});
 await createWithOutbox('committed');assert.equal(await count('note'),1);assert.equal(await count('outbox'),1);
 const provider=new FakeProvider(false);await consumeOne(provider);assert.equal(provider.deliveries.length,1);
 outbox.push({name:'committed before consumer starts',notes:1,events:1,deliveries_after_consumer:1});
 for(const deduplicate of [false,true]){
  await reset();await createWithOutbox('retry');const p=new FakeProvider(deduplicate);
  await assert.rejects(consumeOne(p,{crashAfterSend:true}),/consumer crash/);
  assert.equal(await db.prepare('SELECT sent FROM outbox').first('sent'),0);
  await consumeOne(p);assert.equal(await db.prepare('SELECT sent FROM outbox').first('sent'),1);
  assert.equal(await consumeOne(p),false);assert.equal(p.attempts,2);assert.equal(p.deliveries.length,deduplicate?1:2);
  outbox.push({name:'crash after send before sent flag',provider_deduplication:deduplicate,attempts:p.attempts,deliveries:p.deliveries.length,pending_after_crash:true,sent_after_retry:true});
 }
 console.log(JSON.stringify({node:process.version,wrangler:require('./package.json').version,miniflare:require('miniflare/package.json').version,scope:'Local D1; synthetic notes; fake external provider; no HTTP handler, remote bindings, notification delivery, or production rollout',idempotency,outbox,limitations:['Only successful create-note results are cached','Actor and validated title are trusted function arguments in this lab','Outbox consumer is single-worker; no leasing, concurrent consumers, retry scheduler or DLQ implemented','Fake provider deduplication has no expiry; real provider contracts need separate verification']},null,2));
}finally{await proxy.dispose();rmSync(scratch,{recursive:true,force:true});}
