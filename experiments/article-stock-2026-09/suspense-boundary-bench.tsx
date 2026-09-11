import React, { Suspense, use, useState, useTransition } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';

type Gate = { version: number; promise: Promise<string>; resolve: () => void };
function makeGate(version: number): Gate {
  let resolve!: (value: string) => void;
  const promise = new Promise<string>(done => { resolve = done; });
  return { version, promise, resolve: () => resolve(`Result ${version}`) };
}
function Result({ gate }: { gate: Gate }) {
  return <p id="result">{use(gate.promise)}</p>;
}
function Shell({ children }: { children: React.ReactNode }) {
  return <section id="shell"><h1>Search workspace</h1><input id="query" defaultValue="draft" />{children}</section>;
}
let currentGate: Gate;
function Experiment({ mode, initial }: { mode: string; initial: Gate }) {
  const [gate, setGate] = useState(initial);
  const [pending, startTransition] = useTransition();
  function update() {
    currentGate = makeGate(gate.version + 1);
    if (mode.includes('transition')) startTransition(() => setGate(currentGate));
    else setGate(currentGate);
  }
  const key = mode.endsWith('-key') ? gate.version : 'stable';
  const fallback = <p id="fallback">Loading result</p>;
  const result = <Result gate={gate} />;
  return <><button id="update" onClick={update}>Next result</button><p id="pending">{pending ? 'pending' : 'idle'}</p>{mode.startsWith('broad')
    ? <Suspense fallback={fallback}><Shell>{result}</Shell></Suspense>
    : <Shell><Suspense key={key} fallback={fallback}>{result}</Suspense></Shell>}
  </>;
}
const root = createRoot(document.getElementById('root')!);
Object.assign(window, {
  setupCase(mode: string) {
    currentGate = makeGate(0);
    flushSync(() => root.render(<Experiment key={mode} mode={mode} initial={currentGate} />));
  },
  resolveGate() { currentGate.resolve(); },
});
