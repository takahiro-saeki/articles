import React from 'react';
import { hydrateRoot } from 'react-dom/client';
import { createCounterStore, StoreCounter } from './external-store.mjs';
const bootstrap = window.__BOOTSTRAP__;
const store = createCounterStore({ count: 1 });
const record = { serverSnapshots: [], renders: [], errors: [] };
function getServerSnapshot() {
  record.serverSnapshots.push(bootstrap.count);
  return bootstrap;
}
const root = hydrateRoot(document.getElementById('root'),
  <StoreCounter store={store} getServerSnapshot={getServerSnapshot} rendered={value => record.renders.push(value)} />,
  { onRecoverableError(error) { record.errors.push(error.message); } });
window.readHydration = () => ({ ...record, count: document.getElementById('store-count')?.textContent, subscribers: store.listenerCount() });
window.unmountHydration = () => root.unmount();
