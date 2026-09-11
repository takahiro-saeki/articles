---
title: "When useMemo and useCallback help: count the work they actually skip"
published: false
description: "Production React benchmarks compare cheap arithmetic, a real schedule formatter, and callback props."
tags: [react, javascript, performance, webdev]
canonical_url: "https://zenn.dev/hirodeath/articles/react-memoization-cost"
---

Wrapping a cheap expression in `useMemo` reduced its calculation count but made the overall updates slower. In this small benchmark, updating 2,000 elements 100 times took a median of 29.7ms with direct calculation and 34.5ms with `useMemo`.

A schedule formatter extracted from a real project behaved differently. When its dependencies stayed stable, memoization skipped the calculation during updates. Decide whether to add memoization by checking the work it avoids.

The result for `useCallback` also depended on whether its consumer could skip rendering. This article compares calculation counts and synchronous update time for cases that produce the same output.

## Environment and timing boundaries

The experiment ran on September 11, 2026, with:

- React / React DOM 19.2.5, esbuild 0.27.4, Node.js 24.15.0
- Apple M4 Max, macOS 26.6.2
- HeadlessChrome 152.0.0.0 as reported in User-Agent, launched by Playwright CLI 0.1.19
- A production build, React Compiler disabled, and no CPU throttling

Each case performed 20 warmup updates, then timed 100 root updates with `flushSync` and `performance.now()`. It ran nine rounds, rotating the case order each round. Each case created its own root and unmounted it afterward.

The interval includes React updates and changes committed to the DOM. It excludes subsequent painting, latency from a user interaction, network requests, and clipboard copying. Calculation counters were added for instrumentation. These numbers describe neither the entire application's responsiveness nor performance on users' devices.

The [official useMemo documentation](https://react.dev/reference/react/useMemo) also recommends measuring a production build on a device representative of users. Results from this powerful development machine should not be transferred directly to mobile devices.

## Skipping cheap arithmetic cost more than doing it

The first comparison used `value * 2 + 1` with an unchanged value. Each version rendered 2,000 components: one calculated directly, while the other used the following memoized form. The components themselves were not wrapped in `memo`.

```tsx
function CheapMemo({ value }: { value: number }) {
  const result = useMemo(() => {
    counters.calculations++;
    return value * 2 + 1;
  }, [value]);
  return <span>{result}</span>;
}
```

Every update passed 21. During the measured interval after warmup, the direct version calculated 200,000 times and the memoized version calculated zero times. Both rendered repeated instances of 43.

| Method | Median for 100 updates | Minimum to maximum across nine rounds | Calculations during measurement |
| --- | ---: | ---: | ---: |
| Direct | 29.7ms | 29.1 to 33.4ms | 200,000 |
| useMemo | 34.5ms | 32.9 to 39.5ms | 0 |

The memoized version had a higher median, although the minimum-to-maximum ranges overlap slightly. The 4.8ms difference is between medians for updating 2,000 components 100 times. It does not measure a fixed penalty incurred by every individual Hook.

The memoized path adds work that includes comparing dependencies and retaining a value, while avoiding very cheap arithmetic. For a calculation this small, there is a reason to measure the direct version before adding the Hook.

## A schedule formatter depended on stable dependencies

SquadNote has a `formatMonthlySummary` function that filters schedules by month, groups them by facility, sorts them by date and time, and produces text for sharing. The experiment extracted this [fixed source](https://github.com/takahiro-saeki/circle-hub/blob/770de5f2989775cfd95f7a9c4529565a2b48d2fd/apps/web/src/lib/format-monthly-summary.ts) without modifying it.

In its calling screen, the copied indicator or dialog state can change while the schedules remain the same. The benchmark isolates those updates unrelated to formatting. It does not reproduce the entire screen.

The input contained 1,000 generated schedules, not a measured production workload. Dates, facilities, and cancellation flags were fixed. The DOM displayed the length of the formatted text.

| Method | Median for 100 updates | Formatter calls |
| --- | ---: | ---: |
| Call directly on every update | 48.9ms | 100 |
| Depend on the stable schedules array | 0.1ms | 0 |
| Depend on a new options object each time | 49.5ms | 100 |

Creating a fresh `options` object defeated memoization even though the array contents did not change.

```tsx
function UnstableSummary() {
  const options = { schedules };
  const summary = useMemo(() => calculate(), [options]);
  return <output>{summary.length}</output>;
}
```

Here, `calculate()` wraps the original formatter with the same fixed input and increments a counter. In application code, the lesson is to reconsider whether a fresh object needs to be a dependency, while retaining every reactive value the calculation reads.

Zero calls in the stable case does not mean the formatter never ran. Its initial calculation happened during warmup. The experiment does not show faster initial rendering or faster updates that change the schedules.

## useCallback alone does not stop a child from rendering

The next comparison moved the same formatting work into a child and varied how its parent supplied a callback. Parent update counts and input remained the same.

| Child and props | Median for 100 updates | Child renders |
| --- | ---: | ---: |
| memo child with an inline function | 49.4ms | 100 |
| memo child with useCallback and stable other props | 0.0ms, below measurement resolution | 0 |
| Ordinary child with useCallback | 49.1ms | 100 |
| memo child with useCallback and a fresh object prop | 49.1ms | 100 |

The 0.0ms reading does not mean the work takes no time. This timer could not resolve that short interval, so it is unsuitable for calculating a speedup ratio.

The [official useCallback documentation](https://react.dev/reference/react/useCallback) describes caching a function definition, rather than the result of calling it. It also explains that the Hook does not prevent the creation of a new function. What disappeared in this experiment was the formatting work inside a `memo` child receiving stable props.

An ordinary child continued rendering. Even with `memo`, a different prop holding a fresh object prevented the child from skipping the update. Wrapping only the callback left the expensive operation intact in those cases.

## Return to the actual screen before deciding

Calculation counts were checked across every round, as was equality of DOM output within each comparison group. The [runner](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/run-react-memo-bench.py) uses the formatter from a fixed commit and dependencies with specified versions.

This experiment is not enough to justify removing the screen's existing `useMemo` or adding `useCallback` to every function. A screen that changes its schedules on every update offers fewer chances to reuse the cached result. An application with React Compiler enabled can also produce different code and was outside this comparison.

Compare which interaction causes which calculation, and how often, before and after a change. Leave a small calculation direct if caching offers no useful saving. For expensive work repeated with the same input, stabilize the dependencies and measure again. To skip child renders, inspect the other props as well as the callback. The calculation counts identify which updates are worth inspecting.
