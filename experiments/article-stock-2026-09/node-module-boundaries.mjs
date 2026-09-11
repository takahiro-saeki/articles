import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const root=mkdtempSync(join(tmpdir(),'article-node-modules-'));
const files={
 'package.json':'{"type":"commonjs"}',
 'esm/package.json':'{"type":"module"}',
 'esm/require.js':'console.log(require("node:path"));',
 'esm/legacy.cjs':'console.log(typeof require);',
 'esm/sync.mjs':'export const value = 42;',
 'esm/async.mjs':'await Promise.resolve(); export const value = 42;',
 'esm/no-extension.mjs':'import {value} from "./sync"; console.log(value);',
 'esm/nested/package.json':'{"type":"commonjs"}',
 'esm/nested/legacy.js':'console.log(typeof require);',
 'common/package.json':'{"type":"commonjs"}',
 'common/export.js':'export const value = 42;',
 'common/modern.mjs':'export const value = 42; console.log(value);',
 'common/require-sync.cjs':'console.log(require("../esm/sync.mjs").value);',
 'common/require-async.cjs':'require("../esm/async.mjs");',
 'common/import-async.cjs':'import("../esm/async.mjs").then(m => console.log(typeof require, m.value));',
 'untyped/package.json':'{}',
 'untyped/detected.js':'export const value = 42; console.log(value);',
};
try{
 for(const [name,code] of Object.entries(files)){const path=join(root,name);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,code+'\n');}
 const scenarios=[
  ['esm/require.js',1,'require is not defined'],
  ['common/export.js',1,"Unexpected token 'export'"],
  ['esm/legacy.cjs',0,'function'],
  ['common/modern.mjs',0,'42'],
  ['esm/nested/legacy.js',0,'function'],
  ['common/require-sync.cjs',0,'42'],
  ['common/require-async.cjs',1,'ERR_REQUIRE_ASYNC_MODULE'],
  ['common/import-async.cjs',0,'function 42'],
  ['esm/no-extension.mjs',1,'ERR_MODULE_NOT_FOUND'],
  ['untyped/detected.js',0,'42'],
 ];
 const results=scenarios.map(([entry,exit,expected])=>{
  const env={...process.env};delete env.NODE_OPTIONS;
  const run=spawnSync(process.execPath,[join(root,entry)],{cwd:root,env,encoding:'utf8',timeout:5000});
  assert(!run.error,run.error?.message);assert.equal(run.status,exit,entry);
  assert((exit?run.stderr:run.stdout).includes(expected),entry);
  return {entry,exit:run.status,stdout:run.stdout.trim(),error_code:run.stderr.match(/\bERR_[A-Z_]+\b/)?.[0]??null,expected,typeless_warning:run.stderr.includes('MODULE_TYPELESS_PACKAGE_JSON')};
 });
 console.log(JSON.stringify({node:process.version,scope:'Native Node.js; no bundler, transpiler, custom loader, or NODE_OPTIONS',files,results},null,2));
}finally{rmSync(root,{recursive:true,force:true});}
