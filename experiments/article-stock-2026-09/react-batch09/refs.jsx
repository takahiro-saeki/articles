import React, { useMemo, useState } from 'react';
import { trace } from './trace.js';

function makeTrackedRef(legacy) {
  let observer;
  function disconnect() {
    observer.disconnect();
    trace.active.delete(observer);
    trace.events.push('cleanup');
  }
  return node => {
    if (node === null) {
      trace.events.push('null');
      if (observer) disconnect();
      return;
    }
    observer = new ResizeObserver(() => {});
    observer.observe(node);
    trace.active.add(observer);
    trace.events.push('attach');
    if (!legacy) return disconnect;
  };
}
export function RefExperiment({ stable, legacy }) {
  const [tick, setTick] = useState(0);
  const stableRef = useMemo(() => makeTrackedRef(legacy), [legacy]);
  const ref = stable ? stableRef : makeTrackedRef(legacy);
  return <section>
    <button id="rerender" onClick={() => setTick(previous => previous + 1)}>Render {tick}</button>
    <div id="observed" ref={ref}>Observed node</div>
  </section>;
}
