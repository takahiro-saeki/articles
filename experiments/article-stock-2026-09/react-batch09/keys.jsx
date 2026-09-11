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
