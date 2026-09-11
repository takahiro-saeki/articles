import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { trace, resetTrace } from './trace.js';
import { KeyExperiment } from './keys.jsx';
import { EffectExperiment } from './effects.jsx';
import { FormExperiment } from './forms.jsx';
import { RefExperiment } from './refs.jsx';
import { createCounterStore, StoreCounter } from './external-store.mjs';
import { ActionExperiment, ManualExperiment, PreservingExperiment, ActionBoundary } from './actions.jsx';
let root;
let store;
window.setupCase = function (kind, options = {}) {
  if (root) flushSync(() => root.unmount());
  resetTrace();
  root = createRoot(document.getElementById('root'), { onCaughtError(error) { trace.errors.push(error.message); } });
  let element;
  if (kind === 'keys') element = <KeyExperiment {...options} />;
  if (kind === 'effects') element = <EffectExperiment {...options} />;
  if (kind === 'forms') element = <FormExperiment {...options} />;
  if (kind === 'refs') element = <RefExperiment {...options} />;
  if (kind === 'store') {
    store = createCounterStore({ count: 0 });
    element = <StoreCounter store={store} rendered={count => trace.events.push(count)} />;
  }
  if (kind === 'action') element = <ActionBoundary><ActionExperiment /></ActionBoundary>;
  if (kind === 'manual') element = <ManualExperiment />;
  if (kind === 'preserve') element = <PreservingExperiment />;
  flushSync(() => root.render(options.strict ? <StrictMode>{element}</StrictMode> : element));
};
window.readTrace = () => ({ ...trace, active: trace.active.size, gates: trace.gates.length });
window.unmountCase = () => { flushSync(() => root.unmount()); root = null; };
window.resolveAction = () => { const resolve = trace.gates.shift(); if (!resolve) throw Error('No pending action'); resolve(); };
window.updateStore = (kind, count) => store[kind](count);
window.readStore = () => ({ count: store.getSnapshot().count, subscribers: store.listenerCount() });
window.ready = true;
