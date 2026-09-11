import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const repo=process.argv[2]??'../game-jam-lab';
const commit='f074703848586828b6a5acc0e465ccdd2c0d5244';
const base='events/2026-ai-browser-game-jam-4/';
const show=path=>execFileSync('git',['show',`${commit}:${base}${path}`],{cwd:repo,maxBuffer:30*1024*1024});
const files=new Set(execFileSync('git',['ls-tree','-r','--name-only',commit,base],{cwd:repo,encoding:'utf8'}).trim().split('\n').map(p=>p.slice(base.length)));
const catalog=show('godot/games/charge_clicker/stage_catalog.gd').toString();
function ids(name){
 const array=catalog.match(new RegExp(`const ${name} := \\[([\\s\\S]*?)\\n\\]`));
 assert(array,`${name} array not found`);
 return [...array[1].matchAll(/"id": "([^"]+)"/g)].map(m=>m[1]);
}
const stages=ids('STAGES'),bosses=ids('BOSSES');
assert.equal(stages.length,6);assert.equal(bosses.length,2);
const permutations=items=>items.length?items.flatMap((x,i)=>permutations(items.filter((_,j)=>i!==j)).map(rest=>[x,...rest])):[[]];
const cases=permutations(stages).flatMap(order=>bosses.map(boss=>JSON.stringify({order,boss})));
assert.equal(new Set(cases).size,1440);
const screenshotNames=['01-title-screen','02-gearmaw-combat','03-five-gear-trees','04-arch-singularity','05-artwork-archive','06-prime-current'];
const pngPaths=[...screenshotNames.map(s=>`submission/screenshots/${s}.png`),'submission/cover-630x500.png','submission/cover-630x500-key-art.png'];
const pngs=pngPaths.map(path=>{
 assert(files.has(path));const bytes=show(path);
 if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))
  return {path,format:'PNG',width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)};
 assert.equal(bytes.readUInt16BE(0),0xffd8,`${path}: neither PNG nor JPEG`);
 let offset=2;
 while(offset<bytes.length){
  assert.equal(bytes[offset],0xff);while(bytes[offset]===0xff)offset++;
  const marker=bytes[offset++],length=bytes.readUInt16BE(offset);
  if([0xc0,0xc1,0xc2].includes(marker))return {path,format:'JPEG',width:bytes.readUInt16BE(offset+5),height:bytes.readUInt16BE(offset+3)};
  assert(![0xda,0xd9].includes(marker),`${path}: no supported SOF marker`);offset+=length;
 }
 assert.fail(`${path}: dimensions not found`);
});
const manifest=JSON.parse(show('tools/art-review/data/review-manifest.json'));
const candidates=manifest.batches.flatMap(b=>b.candidates);
assert.equal(new Set(candidates.map(c=>c.id)).size,candidates.length);
const assetRoot='godot/assets/charge_clicker/pixellab/';
const missing=candidates.filter(c=>!files.has(assetRoot+c.file)).map(c=>c.id);
const counts=field=>Object.fromEntries([...new Set(candidates.map(c=>c[field]?.status??'absent'))].map(s=>[s,candidates.filter(c=>(c[field]?.status??'absent')===s).length]));
const chosen=candidates.find(c=>c.id==='final-fallen-machine-seraph-v9-c');assert(chosen);
const derived=assetRoot+'source/enemy/final-fallen-machine-seraph-v9-c-cutout.png';
const runtime=show('godot/games/charge_clicker/charge_clicker.gd').toString();
assert(runtime.includes(derived.slice('godot/'.length)));
const sha=p=>createHash('sha256').update(show(p)).digest('hex');
const effects=candidates.filter(c=>c.id.startsWith('defeat-vfx-')).map(c=>({id:c.id,human_review:c.humanReview.status,preloaded:runtime.includes((assetRoot+c.file).slice('godot/'.length))}));
assert.equal(effects.length,3);assert(effects.every(c=>c.preloaded));
console.log(JSON.stringify({commit,node:process.version,
 route_combinations:{stages:stages.length,first_boss_options:bosses.length,orders:permutations(stages).length,unique_cases:cases.length,scope:'recomputed combinations; Godot audit not executed'},
 pngs,manifest:{batches:manifest.batches.length,candidates:candidates.length,unique_ids:true,missing_files:missing,generation:counts('generation'),human_review:counts('humanReview'),
 selected:{id:chosen.id,model:chosen.model,seed:chosen.seed,codex_status:chosen.codexReview.status,codex_score:chosen.codexReview.score,human_status:chosen.humanReview.status,human_rating:chosen.humanReview.rating,original:chosen.file,original_sha256:sha(assetRoot+chosen.file),runtime_file:derived,runtime_sha256:sha(derived),preloaded:true},effects}},null,2));
