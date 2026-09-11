import assert from 'node:assert/strict';
import { existsSync, mkdtempDisposableSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const records = [];
function resource(name, events, fail = false) {
  events.push(`open:${name}`);
  return { [Symbol.dispose]() {
    events.push(`close:${name}`);
    if (fail) throw new Error(`close failed:${name}`);
  } };
}
function errorTree(error) {
  return error instanceof SuppressedError
    ? { name: error.name, error: errorTree(error.error), suppressed: errorTree(error.suppressed) }
    : { name: error.name, message: error.message };
}
function record(name, action, expected) {
  const events = [];
  const detail = action(events);
  assert.deepEqual(events, expected);
  records.push({ name, events, ...detail });
}
record('normal', events => {
  { using a = resource('A', events); using b = resource('B', events); events.push('body'); }
}, ['open:A', 'open:B', 'body', 'close:B', 'close:A']);
record('return', events => {
  function work() { using a = resource('A', events); return 'done'; }
  const value = work(); events.push(`returned:${value}`);
}, ['open:A', 'close:A', 'returned:done']);
record('body-throws', events => {
  try { using a = resource('A', events); throw new Error('body failed'); }
  catch (error) { assert.equal(error.message, 'body failed'); events.push('caught'); }
}, ['open:A', 'close:A', 'caught']);
record('acquisition-throws', events => {
  function fail() { events.push('open:B failed'); throw new Error('cannot open B'); }
  try { using a = resource('A', events); using b = fail(); }
  catch (error) { assert.equal(error.message, 'cannot open B'); events.push('caught'); }
}, ['open:A', 'open:B failed', 'close:A', 'caught']);
record('body-and-cleanups-throw', events => {
  try { using a = resource('A', events, true); using b = resource('B', events, true); throw new Error('body failed'); }
  catch (error) {
    const tree = errorTree(error);
    assert.equal(tree.name, 'SuppressedError');
    assert.equal(tree.error.message, 'close failed:A');
    assert.equal(tree.suppressed.error.message, 'close failed:B');
    assert.equal(tree.suppressed.suppressed.message, 'body failed');
    return { error: tree };
  }
}, ['open:A', 'open:B', 'close:B', 'close:A']);
{
  const events = [];
  function asyncResource(name) {
    return { async [Symbol.asyncDispose]() {
      events.push(`close start:${name}`);
      await Promise.resolve();
      events.push(`close end:${name}`);
    } };
  }
  async function work() {
    await using a = asyncResource('A');
    await using b = asyncResource('B');
    events.push('body');
  }
  await work(); events.push('after work');
  assert.deepEqual(events, ['body', 'close start:B', 'close end:B', 'close start:A', 'close end:A', 'after work']);
  records.push({ name: 'await-using', events });
}
record('using-only-async-dispose', events => {
  try { using invalid = { async [Symbol.asyncDispose]() { events.push('disposed'); } }; }
  catch (error) { assert(error instanceof TypeError); return { error: errorTree(error) }; }
  throw new Error('Expected TypeError');
}, []);
record('nullish', events => {
  { using absent = null; using missing = undefined; events.push('body'); }
}, ['body']);
{
  let directory;
  let existedInside = false;
  try {
    using temporary = mkdtempDisposableSync(join(tmpdir(), 'article-using-'));
    directory = temporary.path;
    writeFileSync(join(directory, 'sample.txt'), 'local fixture');
    existedInside = existsSync(join(directory, 'sample.txt'));
    throw new Error('work failed');
  } catch (error) { assert.equal(error.message, 'work failed'); }
  assert(existedInside && !existsSync(directory));
  records.push({ name: 'temporary-directory', existedInside, existsAfterThrow: existsSync(directory) });
}
const result = { environment: { node: process.version, platform: process.platform, arch: process.arch, transformed: false }, records };
writeFileSync(new URL('../../production/2026-09/batch-10/using-results.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
