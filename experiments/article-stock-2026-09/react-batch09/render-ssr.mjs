import React from 'react';
import { renderToString } from 'react-dom/server';
import { createCounterStore, StoreCounter } from './external-store.mjs';
const store = createCounterStore({ count: 0 });
const html = renderToString(React.createElement(StoreCounter, { store, getServerSnapshot: store.getSnapshot }));
let missingSnapshotError;
try { renderToString(React.createElement(StoreCounter, { store })); }
catch (error) { missingSnapshotError = error.message; }
console.log(JSON.stringify({ html, bootstrap: store.getSnapshot(), missingSnapshotError }));
