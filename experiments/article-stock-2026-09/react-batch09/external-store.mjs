import React, { useSyncExternalStore } from 'react';

export function createCounterStore(initial) {
  let snapshot = initial;
  const listeners = new Set();
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    replace(count) {
      snapshot = { count };
      for (const listener of listeners) listener();
    },
    mutate(count) {
      snapshot.count = count;
      for (const listener of listeners) listener();
    },
    listenerCount: () => listeners.size,
  };
}
export function StoreCounter({ store, getServerSnapshot, rendered = () => {} }) {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, getServerSnapshot);
  rendered(snapshot.count);
  return React.createElement('output', { id: 'store-count' }, snapshot.count);
}
