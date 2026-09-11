import React, { memo, useCallback, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { formatMonthlySummary } from './source-format-monthly-summary';

// Measurement instrumentation only. No product state or network calls.
const counters = { calculations: 0, children: 0 };
const schedules = Array.from({ length: 1000 }, (_, i) => ({
  date: `2026-09-${String(i % 28 + 1).padStart(2, '0')}`,
  startTime: '09:00', endTime: '11:00', location: `Court ${i % 5}`,
  title: null, isCancelled: i % 7 === 0,
}));
const input = { orgName: 'Benchmark fixture', year: 2026, month: 9, schedules };
function calculate() {
  counters.calculations++;
  return formatMonthlySummary(input);
}
function DirectSummary() { return <output>{calculate().length}</output>; }
function CachedSummary() {
  const summary = useMemo(() => calculate(), [schedules]);
  return <output>{summary.length}</output>;
}
function UnstableSummary() {
  const options = { schedules };
  const summary = useMemo(() => calculate(), [options]);
  return <output>{summary.length}</output>;
}
function CheapDirect({ value }: { value: number }) {
  counters.calculations++;
  return <span>{value * 2 + 1}</span>;
}
function CheapMemo({ value }: { value: number }) {
  const result = useMemo(() => {
    counters.calculations++;
    return value * 2 + 1;
  }, [value]);
  return <span>{result}</span>;
}
function SummaryChild({ onCopy, decoration }: { onCopy: () => number, decoration?: object }) {
  counters.children++;
  return <button onClick={onCopy} data-decorated={!!decoration}>{calculate().length}</button>;
}
const MemoChild = memo(SummaryChild);
function InlineToMemo() { return <MemoChild onCopy={() => schedules.length} />; }
function CallbackToMemo() {
  const onCopy = useCallback(() => schedules.length, [schedules]);
  return <MemoChild onCopy={onCopy} />;
}
function CallbackToPlain() {
  const onCopy = useCallback(() => schedules.length, [schedules]);
  return <SummaryChild onCopy={onCopy} />;
}
function CallbackWithNewProp() {
  const onCopy = useCallback(() => schedules.length, [schedules]);
  return <MemoChild onCopy={onCopy} decoration={{}} />;
}
const cases = {
  cheap: { direct: CheapDirect, memo: CheapMemo },
  summary: { direct: DirectSummary, memo: CachedSummary, unstable: UnstableSummary },
  callback: { inlineMemo: InlineToMemo, callbackMemo: CallbackToMemo, callbackPlain: CallbackToPlain, callbackNewProp: CallbackWithNewProp },
};
const pause = () => new Promise(resolve => setTimeout(resolve, 0));
const host = document.getElementById('root')!;
async function runBench(group: keyof typeof cases) {
  const variants = Object.entries(cases[group]);
  const result: Record<string, any[]> = Object.fromEntries(variants.map(([key]) => [key, []]));
  for (let round = 0; round < 9; round++) {
    // Rotate order so each variant takes different positions across rounds.
    const order = [...variants.slice(round % variants.length), ...variants.slice(0, round % variants.length)];
    for (const [name, Component] of order) {
      const root = createRoot(host);
      const render = () => {
        const elements = group === 'cheap'
          ? Array.from({ length: 2000 }, (_, i) => <Component key={i} value={21} />)
          : <Component value={21} />;
        flushSync(() => root.render(elements));
      };
      for (let i = 0; i < 20; i++) render();
      counters.calculations = 0; counters.children = 0;
      const start = performance.now();
      for (let i = 0; i < 100; i++) render();
      const elapsed = performance.now() - start;
      result[name].push({ ms: elapsed, ...counters, outputLength: host.textContent!.length, output: host.textContent });
      flushSync(() => root.unmount());
      await pause();
    }
  }
  return { group, react: React.version, userAgent: navigator.userAgent, rounds: 9, updates: 100, warmups: 20, cheapLeaves: 2000, fixtureSchedules: schedules.length, results: result };
}
(window as any).runBench = runBench;
document.getElementById('status')!.textContent = `Ready: React ${React.version}, production, compiler off`;
