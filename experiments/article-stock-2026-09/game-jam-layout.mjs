import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const repo=resolve(process.argv[2]??'../game-jam-lab');
const ref='f074703848586828b6a5acc0e465ccdd2c0d5244';
const paths=execFileSync('git',['-C',repo,'ls-tree','-r','--name-only',ref],{encoding:'utf8'}).trim().split('\n');
const events=[...new Set(paths.filter(x=>x.startsWith('events/')).map(x=>x.split('/')[1]))];
assert.deepEqual(events,['2026-ai-browser-game-jam-4']);
const sourcePath='events/2026-ai-browser-game-jam-4/tools/build-itch-project-charge.sh';
const script=execFileSync('git',['-C',repo,'show',`${ref}:${sourcePath}`],{encoding:'utf8'});
const scratch=mkdtempSync(join(tmpdir(),'article-game-layout-'));
const eventRoot=join(scratch,'events/renamed-fixture-event');
mkdirSync(join(eventRoot,'tools'),{recursive:true});mkdirSync(join(eventRoot,'godot'));
const scriptPath=join(eventRoot,'tools/build-itch-project-charge.sh');writeFileSync(scriptPath,script);
execFileSync('bash',['-n',scriptPath]);
const mockBin=join(scratch,'mock-bin');mkdirSync(mockBin);
writeFileSync(join(mockBin,'godot'),`#!/usr/bin/env node
const fs=require('node:fs'),path=require('node:path');
const args=process.argv.slice(2);
fs.writeFileSync(process.env.ARTICLE_GODOT_CALL,JSON.stringify(args));
const output=args[args.length-1];
for(const ext of ['html','js','pck','wasm'])fs.writeFileSync(path.join(path.dirname(output),'index.'+ext),'fixture only');
`,{mode:0o755});
const runs=[];
for(const cwd of [scratch,join(eventRoot,'godot')]){
 const call=join(scratch,'godot-call.json');
 execFileSync('bash',[scriptPath],{cwd,env:{...process.env,PATH:`${mockBin}:${process.env.PATH}`,ARTICLE_GODOT_CALL:call},encoding:'utf8'});
 const args=JSON.parse(readFileSync(call,'utf8'));
 assert.equal(args[args.indexOf('--path')+1],join(eventRoot,'godot'));
 assert.equal(args[args.indexOf('--export-release')+1],'Itch Volt Nomad');
 const zip=join(eventRoot,'build/itch/volt-nomad-web.zip');assert(existsSync(zip));
 const zipEntries=execFileSync('/usr/bin/unzip',['-Z1',zip],{encoding:'utf8'}).trim().split('\n').sort();
 assert.deepEqual(zipEntries,['index.html','index.js','index.pck','index.wasm']);
 runs.push({cwd:cwd===scratch?'repository root':'event godot directory',target:'events/renamed-fixture-event/godot',zipEntries});
}
console.log(JSON.stringify({ref,node:process.version,committedEvents:events,eventSharedFiles:paths.filter(x=>x.startsWith('events/2026-ai-browser-game-jam-4/godot/shared/')),rootToolsPresent:paths.some(x=>x.startsWith('tools/')),scope:'Committed tree inspection, bash -n, real export shell with a stubbed Godot executable. Fixture files only; no game export, smoke test, upload, or deployment.',runs},null,2));
