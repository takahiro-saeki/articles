import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { build, version as esbuildVersion } from 'esbuild';

const here = dirname(fileURLToPath(import.meta.url));
const output = join(here, '../../../production/2026-09/batch-08');
const tsc = join(here, 'node_modules/typescript/bin/tsc');
const fixtures = JSON.parse(readFileSync(join(here, 'compiler-cases.json'), 'utf8'));
const scratch = mkdtempSync(join(tmpdir(), 'article-language-'));
const results = [];
const clean = text => text.replaceAll(scratch, '<scratch>').trim();
try {
  for (const fixture of fixtures) {
    const cwd = join(scratch, fixture.name);
    mkdirSync(cwd);
    writeFileSync(join(cwd, 'package.json'), '{"type":"module"}\n');
    for (const [name, body] of Object.entries(fixture.files)) writeFileSync(join(cwd, name), body + '\n');
    const config = { compilerOptions: {
      target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler',
      strict: true, types: [], lib: ['ES2022', 'DOM'],
      declaration: true, noEmitOnError: true, outDir: './out',
      verbatimModuleSyntax: false, ...fixture.options,
    }, include: ['*.ts'] };
    writeFileSync(join(cwd, 'tsconfig.json'), JSON.stringify(config, null, 2));
    const compile = spawnSync(process.execPath, [tsc, '-p', 'tsconfig.json', '--pretty', 'false'], { cwd, encoding: 'utf8' });
    const diagnostics = clean(compile.stdout + compile.stderr);
    const diagnosticCodes = [...diagnostics.matchAll(/TS(\d+):/g)].map(x => Number(x[1]));
    assert.deepEqual(diagnosticCodes.sort((a,b)=>a-b), [...fixture.expectedDiagnostics].sort((a,b)=>a-b), `${fixture.name}: ${diagnostics}`);
    assert.equal(compile.status === 0, fixture.expectedDiagnostics.length === 0, fixture.name);
    const result = { name: fixture.name, article: fixture.article, config, exit: compile.status, diagnostics, diagnosticCodes };
    if (compile.status === 0) {
      result.javascript = readFileSync(join(cwd, 'out/main.js'), 'utf8');
      result.declaration = readFileSync(join(cwd, 'out/main.d.ts'), 'utf8');
      for (const text of fixture.expectedDeclaration ?? []) assert(result.declaration.includes(text), `${fixture.name}: missing declaration ${text}`);
      const runtime = spawnSync(process.execPath, ['out/main.js'], { cwd, encoding: 'utf8' });
      result.runtime = { exit: runtime.status, stdout: clean(runtime.stdout), stderr: clean(runtime.stderr) };
      assert.equal(runtime.status, 0, `${fixture.name}: ${runtime.stderr}`);
      if ('expectedRuntime' in fixture) assert.equal(result.runtime.stdout, fixture.expectedRuntime, fixture.name);
    }
    if (fixture.esbuild) {
      try {
        const bundle = await build({ entryPoints: [join(cwd, 'main.ts')], bundle: true,
          platform: 'node', format: 'esm', target: 'es2022', write: false,
          logLevel: 'silent', metafile: true, absWorkingDir: cwd,
          tsconfig: join(cwd, 'tsconfig.json'), treeShaking: true });
        const javascript = bundle.outputFiles[0].text;
        writeFileSync(join(cwd, 'bundle.mjs'), javascript);
        const runtime = spawnSync(process.execPath, ['bundle.mjs'], { cwd, encoding: 'utf8' });
        result.esbuild = { exit: 0, javascript, inputs: Object.keys(bundle.metafile.inputs),
          runtime: { exit: runtime.status, stdout: clean(runtime.stdout), stderr: clean(runtime.stderr) } };
        assert.equal(runtime.status, 0, fixture.name);
        assert.equal(result.esbuild.runtime.stdout, fixture.esbuild.expectedRuntime, fixture.name);
        assert(!fixture.esbuild.expectedError, `${fixture.name}: expected bundling error`);
      } catch (error) {
        if (!error.errors) throw error;
        result.esbuild = { exit: 1, errors: error.errors.map(e => e.text) };
        assert(fixture.esbuild.expectedError, `${fixture.name}: unexpected bundling error`);
        assert(result.esbuild.errors.some(x => x.includes(fixture.esbuild.expectedError)));
      }
    }
    if (fixture.nodeStrip) {
      const native = spawnSync(process.execPath, ['main.ts'], { cwd, encoding: 'utf8' });
      result.nodeStrip = { exit: native.status, stdout: clean(native.stdout), stderr: clean(native.stderr) };
      assert(native.stderr.includes(fixture.nodeStrip.expectedError));
      assert.notEqual(native.status, 0);
    }
    results.push(result);
  }
  mkdirSync(output, { recursive: true });
  writeFileSync(join(output, 'compiler-results.json'), JSON.stringify({
    environment: { node: process.version, platform: process.platform, arch: process.arch,
      typescript: execFileSync(process.execPath, [tsc, '--version'], { encoding: 'utf8' }).trim(), esbuild: esbuildVersion },
    cases: results,
  }, null, 2) + '\n');
  console.log(`Compiler cases passed: ${results.length}`);
} finally { rmSync(scratch, { recursive: true, force: true }); }
