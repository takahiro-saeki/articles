---
title: "How index keys affect inputs: compare DOM, row state, and parent state"
published: false
tags: react, javascript, testing
canonical_url: null
---

When the first row is removed from a React list, do input values stay with the remaining rows? With index keys, the result depended on who owned the value.

An uncontrolled input, whose value lived in the DOM, and an input backed by row-local state displayed another row's value. Inputs receiving values from parent state displayed the correct values, but their DOM nodes were still reassigned to different rows.

## Narrow the reproduction from existing code

The personal project's [schedule creation screen](https://github.com/takahiro-saeki/circle-hub/blob/770de5f2989775cfd95f7a9c4529565a2b48d2fd/apps/web/src/app/%28app%29/organizations/%5Bid%5D/schedules/new/page.tsx) passes the `idx` from `rows.map` as each `Card` key. It removes rows with array filtering and inserts duplicates by combining array slices.

However, its title input is controlled through `value={row.title}`. The code alone does not show whether input values ever became mixed up in production. The inspected commit was `770de5f`. Related history and design material were also checked before extracting row deletion and value ownership into a separate experiment. The application was neither modified nor used to submit data.

## Removing the first row shifts index-based identities

The fixture starts with 3 rows: A, B, and C. B is edited to `edited-B`, then A is removed. Simply reversing the order after editing B would leave B in the middle of a 3-row list, so deletion makes the identity change visible here.

```jsx
import React, { useState } from 'react';

const initialRows = [
  { id: 'A', title: 'Alpha' },
  { id: 'B', title: 'Beta' },
  { id: 'C', title: 'Gamma' },
];
function Row({ row, mode, update }) {
  const [localTitle, setLocalTitle] = useState(row.title);
  const props = mode === 'uncontrolled'
    ? { defaultValue: row.title }
    : mode === 'local'
      ? { value: localTitle, onChange: event => setLocalTitle(event.target.value) }
      : { value: row.title, onChange: event => update(row.id, event.target.value) };
  return <label data-row={row.id}>{row.id}<input {...props} /></label>;
}
export function KeyExperiment({ keyMode, mode }) {
  const [rows, setRows] = useState(initialRows);
  function update(id, title) {
    setRows(previous => previous.map(row => row.id === id ? { ...row, title } : row));
  }
  return <section>
    <button id="remove-first" onClick={() => setRows(previous => previous.slice(1))}>Remove first</button>
    {rows.map((row, index) => (
      <Row key={keyMode === 'index' ? index : row.id} row={row} mode={mode} update={update} />
    ))}
  </section>;
}
```

`mode` is `uncontrolled`, `local`, or `parent`; `keyMode` is `index` or `id`. The local version initializes each row with `useState(row.title)`. The parent version updates the array by row ID.

Before deletion, a WeakMap records each input's DOM node and row ID. After deletion, the test compares values and node origins. This is fixture instrumentation, not access to React's internal keys.

| Value owner | Key | Values displayed for B / C after deletion | Original rows of the nodes used for B / C |
| --- | --- | --- | --- |
| DOM | index | Alpha / edited-B | A / B |
| DOM | id | edited-B / Gamma | B / C |
| Row state | index | Alpha / edited-B | A / B |
| Row state | id | edited-B / Gamma | B / C |
| Parent state | index | edited-B / Gamma | A / B |
| Parent state | id | edited-B / Gamma | B / C |

With index keys, B gets key `0` and C gets key `1` after deletion. Those keys previously corresponded to A and B. `defaultValue` and a row's initial state are not reapplied from scratch for every new row occupying that position.

With ID keys, B remains key `B` even after moving. Its edited value and DOM node stayed with that row. [React's explanation of list keys](https://react.dev/learn/rendering-lists#keeping-list-items-in-order-with-key) describes their role in matching items through deletion, insertion, and reordering.

## Controlled values do not settle the identity question

In the parent-state version, React passed the new `row.title` to each input, so the displayed values were correct. The 6 cases therefore do not support a claim that index keys always produce incorrect displayed values.

The WeakMap still identified the reused nodes as coming from A / B. Correct values alone do not prove that row, component, and DOM identities were preserved. The experiment did not measure focus, IME composition, or DatePicker internal state. It therefore does not establish failures in those parts of the real application either.

For a design that adds and removes rows, storing a row ID in the data and keeping it as the key for the row's lifetime expresses the intended identity. Unsaved rows can receive an ID when created, and a duplicate treated as a separate row can receive a new ID. Generating IDs during every render would not provide stable matching. This is a proposed change for the existing screen, not an applied fix.

The tests ran on September 11, 2026, with React and React DOM 19.3.0, Node.js 24.15.0, esbuild 0.28.2, macOS arm64, and Headless Chrome 152. They used a production build without Strict Mode or React Compiler. The [minimal code](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/react-batch09/keys.jsx) and [results for the 6 conditions](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/production/2026-09/batch-09/browser-results.json) track displayed values and DOM nodes separately.
