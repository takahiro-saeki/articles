import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const require = createRequire(resolve('experiments/article-stock-2026-09/mobile-batch15/package.json'));
const babel = require('@babel/core');
const generate = require('@babel/generator').default;
const out = 'production/2026-09/batch-15';
const sources = [];
function source(specifier) {
  const path = resolve('experiments/article-stock-2026-09/mobile-batch15/node_modules', specifier), text = readFileSync(path, 'utf8');
  sources.push({ specifier, bytes: Buffer.byteLength(text), sha256: createHash('sha256').update(text).digest('hex') });
  return text;
}
const linkingSource = source('expo-router/build/link/linking.js');
const nativeUseLinking = source('expo-router/build/fork/useLinking.native.js');
const timeoutSource = nativeUseLinking.slice(nativeUseLinking.indexOf('function getInitialURLWithTimeout()'), nativeUseLinking.indexOf('//# sourceMappingURL'));
const configSource = source('expo-router/build/getLinkingConfig.js');
const appStateSource = source('react-native/Libraries/AppState/AppState.js');
source('react-native/React/CoreModules/RCTAppState.mm');
source('react-native/ReactAndroid/src/main/java/com/facebook/react/modules/appstate/AppStateModule.kt');
source('expo-router/build/utils/splash.js');
source('expo-splash-screen/src/index.native.ts');
function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
function makeLinking(os, iosURL = null) {
  const native = deferred(), timers = [], calls = { ios: 0, android: 0, removed: 0 };
  let listener;
  const platform = { OS: os };
  const ExpoLinking = {
    getLinkingURL() { calls.ios++; return iosURL; },
    createURL: path => 'articlelab://' + path,
    addEventListener: (_type, callback) => { listener = callback; return { remove() { calls.removed++; listener = undefined; } }; },
  };
  const rn = { Platform: platform, Linking: { getInitialURL() { calls.android++; return native.promise; } } };
  const timeout = new Function('window', 'react_native_1', 'ExpoLinking', 'setTimeout', timeoutSource + ';return getInitialURLWithTimeout;')({}, rn, ExpoLinking, (callback, delay) => { timers.push({ callback, delay }); return timers.length; });
  const dependencies = {
    'expo-linking': ExpoLinking, 'react-native': rn,
    '../fork/extractPathFromURL': {}, '../fork/getPathFromState': {}, '../fork/getStateFromPath': {},
    '../fork/useLinking': { getInitialURLWithTimeout: timeout }, '../getRoutesRedirects': { applyRedirects: url => url },
  };
  const exported = {};
  new Function('require', 'exports', 'window', linkingSource)(id => { assert(id in dependencies, id); return dependencies[id]; }, exported, {});
  return { exported, native, timers, calls, emit: async url => { assert(listener); await listener({ url }); } };
}
const urls = [];
let lab = makeLinking('ios', 'articlelab://detail?item=cold');
const immediate = lab.exported.getInitialURL();
assert.equal(immediate, 'articlelab://detail?item=cold'); assert.equal(typeof immediate, 'string'); assert.equal(lab.calls.android, 0);
urls.push({ name: 'ios-synchronous-getter', value: immediate, calls: { ...lab.calls } });
lab = makeLinking('ios', null); assert.equal(lab.exported.getInitialURL(), 'articlelab:///');
urls.push({ name: 'ios-no-url', value: 'articlelab:///' });
lab = makeLinking('android'); let initial = lab.exported.getInitialURL();
assert.equal(lab.timers[0].delay, 150); lab.native.resolve('articlelab://detail?item=early');
assert.equal(await initial, 'articlelab://detail?item=early');
urls.push({ name: 'android-native-resolves-first', value: await initial, timeoutArgument: lab.timers[0].delay });
lab = makeLinking('android'); initial = lab.exported.getInitialURL();
lab.timers[0].callback(); assert.equal(await initial, 'articlelab:///');
lab.native.resolve('articlelab://detail?item=late'); assert.equal(await initial, 'articlelab:///');
const runtime = []; const remove = lab.exported.subscribe(undefined, [])(url => runtime.push(url));
assert.deepEqual(runtime, []); await lab.emit('articlelab://detail?item=runtime'); remove();
assert.deepEqual(runtime, ['articlelab://detail?item=runtime']); assert.equal(lab.calls.removed, 1);
urls.push({ name: 'android-timeout-before-native', initial: await initial, lateInitialDidNotChangeResult: true, runtimeEvents: runtime, removed: lab.calls.removed });
lab = makeLinking('android'); initial = lab.exported.getInitialURL();
lab.native.reject(new Error('synthetic initial-url failure')); await assert.rejects(initial, /synthetic initial-url failure/);
urls.push({ name: 'android-rejection-before-timeout', rejected: true });
lab = makeLinking('android');
const configDeps = {
  '@react-navigation/native': {}, 'expo-modules-core': { Platform: { OS: 'android' } },
  './constants': { INTERNAL_SLOT_NAME: '__slot' }, './getReactNavigationConfig': { getReactNavigationConfig: () => ({ screens: {} }) },
  './getRoutesRedirects': { applyRedirects: url => url }, './link/linking': lab.exported,
};
const configExports = {};
new Function('require', 'exports', configSource)(id => { assert(id in configDeps, id); return configDeps[id]; }, configExports);
const context = () => undefined; context.keys = () => [];
const config = configExports.getLinkingConfig({}, context, () => ({ segments: [] }), { skipGenerated: true, redirects: [] });
const first = config.getInitialURL(), second = config.getInitialURL(); assert.equal(first, second); assert.equal(lab.calls.android, 1);
lab.native.resolve('articlelab://detail?item=once'); assert.equal(await first, 'articlelab://detail?item=once');
urls.push({ name: 'configuration-memoizes-initial-promise', identicalPromise: true, nativeCalls: lab.calls.android });

const appStateJS = babel.transformSync(appStateSource, { filename: 'AppState.js', presets: [require.resolve('@react-native/babel-preset')], babelrc: false, configFile: false }).code;
function makeAppState(initialState = 'active', os = 'android') {
  let currentCallback, emitter;
  class Emitter {
    handlers = new Map();
    constructor() { emitter = this; }
    addListener(event, callback) { const list = this.handlers.get(event) ?? []; list.push(callback); this.handlers.set(event, list); return { remove: () => this.handlers.set(event, list.filter(x => x !== callback)) }; }
    emit(event, value) { for (const fn of [...(this.handlers.get(event) ?? [])]) fn(value); }
  }
  const deps = {
    '../EventEmitter/NativeEventEmitter': Emitter, '../Utilities/logError': error => { throw error; },
    '../Utilities/Platform': { OS: os }, './NativeAppState': { getConstants: () => ({ initialAppState: initialState }), getCurrentAppState: callback => { currentCallback = callback; } },
  };
  const exported = {};
  new Function('require', 'exports', appStateJS)(id => id.startsWith('@babel/') ? require(id) : (assert(id in deps, id), deps[id]), exported);
  return { state: exported.default, emit: (name, value) => emitter.emit(name, value), current: value => currentCallback({ app_state: value }) };
}
const states = [];
let stateLab = makeAppState(), changes = [], focus = [], blur = [];
stateLab.state.addEventListener('change', x => changes.push(x));
stateLab.state.addEventListener('focus', () => focus.push(true)); stateLab.state.addEventListener('blur', () => blur.push(true));
stateLab.current('active'); stateLab.emit('appStateFocusChange', false); stateLab.emit('appStateFocusChange', true);
assert.deepEqual(changes, []); assert.equal(stateLab.state.currentState, 'active');
states.push({ name: 'focus-events-do-not-change-state', changeCalls: changes.length, blurCalls: blur.length, focusCalls: focus.length, currentState: stateLab.state.currentState });
for (const value of ['inactive', 'background', 'active']) stateLab.emit('appStateDidChange', { app_state: value });
assert.deepEqual(changes, ['inactive', 'background', 'active']);
states.push({ name: 'supplied-state-transition', values: [...changes], currentState: stateLab.state.currentState });
stateLab = makeAppState(); changes = [];
const sub = stateLab.state.addEventListener('change', x => changes.push(x));
stateLab.emit('appStateDidChange', { app_state: 'active' }); stateLab.emit('appStateDidChange', { app_state: 'active' });
assert.deepEqual(changes, ['active', 'active']); sub.remove(); stateLab.emit('appStateDidChange', { app_state: 'background' });
assert.equal(changes.length, 2); assert.equal(stateLab.state.currentState, 'background');
states.push({ name: 'js-callback-does-not-deduplicate-and-cleanup', callbackValues: changes, stateAfterCleanup: stateLab.state.currentState });
stateLab = makeAppState(null); changes = []; stateLab.state.addEventListener('change', x => changes.push(x)); stateLab.current('active');
assert.deepEqual(changes, ['active']); states.push({ name: 'initial-null-retrieval', callbackValues: changes });
stateLab = makeAppState('active'); changes = []; stateLab.state.addEventListener('change', x => changes.push(x));
stateLab.emit('appStateDidChange', { app_state: 'background' }); stateLab.current('active');
assert.equal(stateLab.state.currentState, 'background'); states.push({ name: 'late-initial-callback-does-not-overwrite-event', currentState: stateLab.state.currentState, callbackValues: changes });

const repo = '/Users/takahiro_saeki/Documents/GitHub/circle-hub-growth-07-schedule-import';
const push = execFileSync('git', ['-C', repo, 'show', 'a34608c611ded6549c1176a7977e68e1bc62a8db:apps/mobile/src/lib/push-notifications.ts'], { encoding: 'utf8' });
const ast = babel.parseSync(push, { filename: 'push.ts', parserOpts: { plugins: ['typescript'] }, babelrc: false, configFile: false });
const hook = ast.program.body.find(x => x.type === 'ExportNamedDeclaration' && x.declaration?.id?.name === 'useRegisterPushToken').declaration;
const effects = hook.body.body.filter(x => x.type === 'ExpressionStatement' && x.expression.callee?.name === 'useEffect');
const callback = generate(effects[1].expression.arguments[0]).code;
assert(callback.includes('AppState.addEventListener') && callback.includes('setBadgeCountAsync'));
stateLab = makeAppState('active', 'ios'); let badgeCalls = 0;
const cleanup = new Function('AppState', 'enabled', 'Notifications', 'return (' + callback + ')();')(stateLab.state, true, { setBadgeCountAsync: async value => { assert.equal(value, 0); badgeCalls++; } });
assert.equal(badgeCalls, 1);
for (const value of ['inactive', 'background', 'active']) stateLab.emit('appStateDidChange', { app_state: value });
assert.equal(badgeCalls, 2);
stateLab.emit('appStateFocusChange', false); assert.equal(badgeCalls, 2);
cleanup(); stateLab.emit('appStateDidChange', { app_state: 'active' }); assert.equal(badgeCalls, 2);
states.push({ name: 'actual-badge-effect', afterMount: 1, afterSuppliedResume: 2, afterBlurAndCleanup: badgeCalls, realNotificationAPI: false });

writeFileSync(out + '/mobile-js-experiment.json', JSON.stringify({ node: process.version, versions: Object.fromEntries(['expo', 'expo-router', 'expo-linking', 'react-native'].map(name => [name, require(name + '/package.json').version])), sourceFiles: sources, initialURLCases: urls, appStateCases: states, scope: 'Actual installed package JavaScript with substituted native boundary and controlled timer callbacks; not device timing or OS event generation', nativeAppExecuted: false }, null, 2) + '\n');
console.log(`Verified ${urls.length} initial URL cases and ${states.length} AppState cases using actual package JavaScript; native boundary substituted.`);
