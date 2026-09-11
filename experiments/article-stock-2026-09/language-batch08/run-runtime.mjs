import assert from 'node:assert/strict';
import { getEventListeners } from 'node:events';
import { setTimeout as nodeDelay } from 'node:timers/promises';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { delay } from './cancellable-delay.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const output = join(here, '../../../production/2026-09/batch-08');
mkdirSync(output, { recursive: true });
const cloneCases = [];
const jsonCopy = value => JSON.parse(JSON.stringify(value));
function probe(name, value, inspect, expectedClone, expectedJson) {
  const copy = fn => {
    try { return { ok: true, value: inspect(fn(value)) }; }
    catch (e) { return { ok: false, error: e.name }; }
  };
  const result = { name, structuredClone: copy(structuredClone), jsonRoundtrip: copy(jsonCopy) };
  assert.deepEqual(result.structuredClone, expectedClone, name);
  assert.deepEqual(result.jsonRoundtrip, expectedJson, name);
  cloneCases.push(result);
}
const ok = value => ({ ok: true, value });
const error = name => ({ ok: false, error: name });
probe('Date', new Date('2026-09-11T00:00:00.000Z'), x => ({ date: x instanceof Date, text: x instanceof Date ? x.toISOString() : x }), ok({ date: true, text: '2026-09-11T00:00:00.000Z' }), ok({ date: false, text: '2026-09-11T00:00:00.000Z' }));
probe('Map', new Map([['ready', 2]]), x => ({ map: x instanceof Map, entries: x instanceof Map ? [...x] : Object.entries(x) }), ok({ map: true, entries: [['ready', 2]] }), ok({ map: false, entries: [] }));
probe('undefined-object', { memo: undefined }, x => Object.hasOwn(x, 'memo'), ok(true), ok(false));
probe('undefined-array', [undefined], x => ({ first: String(x[0]), length: x.length }), ok({ first: 'undefined', length: 1 }), ok({ first: 'null', length: 1 }));
probe('special-numbers', [NaN, Infinity, -0], x => [Number.isNaN(x[0]), x[1] === Infinity, Object.is(x[2], -0)], ok([true, true, true]), ok([false, false, false]));
const row = { id: 'draft-1' };
probe('shared-reference', { left: row, right: row }, x => ({ shared: x.left === x.right, original: x.left === row }), ok({ shared: true, original: false }), ok({ shared: false, original: false }));
const cycle = { id: 'draft-1' }; cycle.self = cycle;
probe('cycle', cycle, x => x.self === x, ok(true), error('TypeError'));
probe('BigInt', { value: 1n }, x => typeof x.value, ok('bigint'), error('TypeError'));
probe('function-property', { run() {} }, x => Object.hasOwn(x, 'run'), error('DataCloneError'), ok(false));
class Draft { constructor() { this.title = 'Ready'; } label() { return this.title; } }
probe('class-instance', new Draft(), x => ({ instance: x instanceof Draft, method: typeof x.label, title: x.title }), ok({ instance: false, method: 'undefined', title: 'Ready' }), ok({ instance: false, method: 'undefined', title: 'Ready' }));
probe('frozen-object', Object.freeze({ count: 1 }), x => ({ frozen: Object.isFrozen(x), writable: Object.getOwnPropertyDescriptor(x, 'count').writable }), ok({ frozen: false, writable: true }), ok({ frozen: false, writable: true }));
let reads = 0;
const getter = { get value() { reads++; return 2; } };
probe('getter', getter, x => ({ value: x.value, getter: typeof Object.getOwnPropertyDescriptor(x, 'value').get }), ok({ value: 2, getter: 'undefined' }), ok({ value: 2, getter: 'undefined' }));
assert.equal(reads, 2);
const bytes = new Uint8Array([1, 2, 3]);
const moved = structuredClone(bytes, { transfer: [bytes.buffer] });
assert.equal(bytes.byteLength, 0); assert.deepEqual([...moved], [1, 2, 3]);
const example = execFileSync(process.execPath, [join(here, 'clone-example.mjs')], { encoding: 'utf8' }).trim();
assert.equal(example, 'true string\n2 {}\ntrue false\nundefined null\ntrue false');
writeFileSync(join(output, 'clone-results.json'), JSON.stringify({ environment: { node: process.version }, cases: cloneCases,
  getterReadsAcrossBothCopies: reads, transfer: { sourceByteLength: bytes.byteLength, destination: [...moved] }, example }, null, 2) + '\n');

const cancellationCases = [];
const listeners = signal => getEventListeners(signal, 'abort').length;
const settle = promise => promise.then(value => ({ status: 'fulfilled', value }), reason => ({ status: 'rejected', reason }));
{
  const controller = new AbortController();
  const reason = new Error('already stopped'); controller.abort(reason);
  const result = await settle(delay(10000, controller.signal));
  assert.equal(result.status, 'rejected'); assert.equal(result.reason, reason); assert.equal(listeners(controller.signal), 0);
  cancellationCases.push({ name: 'already-aborted', status: result.status, sameReason: true, remainingListeners: 0 });
}
{
  const controller = new AbortController(); const reason = new Error('stop group');
  const a = settle(delay(10000, controller.signal)); const b = settle(delay(10000, controller.signal));
  assert.equal(listeners(controller.signal), 2);
  controller.abort(reason);
  const result = await Promise.all([a, b]);
  assert(result.every(x => x.status === 'rejected' && x.reason === reason)); assert.equal(listeners(controller.signal), 0);
  cancellationCases.push({ name: 'shared-signal', statuses: result.map(x => x.status), sameReason: true, listenersBefore: 2, remainingListeners: 0 });
}
{
  const controller = new AbortController();
  const result = await settle(delay(0, controller.signal));
  assert.equal(result.value, 'finished'); assert.equal(listeners(controller.signal), 0);
  controller.abort(new Error('too late'));
  assert.equal(result.status, 'fulfilled');
  cancellationCases.push({ name: 'abort-after-finish', status: result.status, remainingListeners: listeners(controller.signal) });
}
{
  const controller = new AbortController(); let ignoredTaskFinished = false;
  const cooperative = settle(delay(10000, controller.signal));
  const ignored = nodeDelay(0).then(() => { ignoredTaskFinished = true; return 'finished'; });
  controller.abort();
  const stopped = await cooperative; const continuing = await ignored;
  assert.equal(stopped.reason.name, 'AbortError'); assert(ignoredTaskFinished); assert.equal(continuing, 'finished');
  cancellationCases.push({ name: 'task-without-signal', cooperative: stopped.status, ignored: 'fulfilled', ignoredTaskFinished });
}
{
  const controller = new AbortController(); const reason = new Error('timer stopped');
  const pending = settle(nodeDelay(10000, 'value', { signal: controller.signal })); controller.abort(reason);
  const result = await pending;
  assert.equal(result.reason.name, 'AbortError'); assert.equal(result.reason.cause, reason); assert.notEqual(result.reason, reason);
  cancellationCases.push({ name: 'node-timers-promise', status: result.status, errorName: result.reason.name, sameReason: false, causeIsReason: true });
}
{
  const controller = new AbortController(); const timeout = AbortSignal.timeout(10000);
  const signal = AbortSignal.any([controller.signal, timeout]); const reason = new Error('manual cancel');
  const pending = settle(delay(10000, signal)); controller.abort(reason);
  const result = await pending;
  assert.equal(result.reason, reason); assert.equal(signal.reason, reason); assert.equal(listeners(signal), 0);
  cancellationCases.push({ name: 'combined-manual-signal', status: result.status, sameReason: true, remainingListeners: 0 });
}
{
  const signal = AbortSignal.timeout(1); const result = await settle(delay(10000, signal));
  assert.equal(result.reason.name, 'TimeoutError'); assert.equal(result.reason, signal.reason); assert.equal(listeners(signal), 0);
  cancellationCases.push({ name: 'timeout-signal', status: result.status, errorName: result.reason.name, sameReason: true, remainingListeners: 0 });
}
writeFileSync(join(output, 'abort-results.json'), JSON.stringify({ environment: { node: process.version }, cases: cancellationCases }, null, 2) + '\n');
console.log(`Runtime cases passed: ${cloneCases.length} clone cases + transfer; ${cancellationCases.length} cancellation cases`);
