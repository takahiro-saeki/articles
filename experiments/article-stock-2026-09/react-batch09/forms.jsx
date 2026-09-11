import React, { useState } from 'react';
import { trace } from './trace.js';

const initialValue = index => `field-${index}`;
function ControlledField({ index, value, onChange }) {
  trace.fieldRenders++;
  return <input name={`field-${index}`} value={value} onChange={onChange} />;
}
function LocalField({ index }) {
  trace.fieldRenders++;
  const [value, setValue] = useState(initialValue(index));
  return <input name={`field-${index}`} value={value} onChange={event => {
    trace.fieldChanges++;
    setValue(event.target.value);
  }} />;
}
function UncontrolledField({ index }) {
  trace.fieldRenders++;
  return <input name={`field-${index}`} defaultValue={initialValue(index)} />;
}
export function FormExperiment({ mode, size }) {
  trace.formRenders++;
  const [values, setValues] = useState(() => Array.from({ length: size }, (_, index) => initialValue(index)));
  const [epoch, setEpoch] = useState(0);
  function resetExplicitly() {
    if (mode === 'root') setValues(Array.from({ length: size }, (_, index) => initialValue(index)));
    else if (mode === 'local') setEpoch(previous => previous + 1);
    else document.getElementById('fields').reset();
  }
  return <section>
    <button id="explicit-reset" onClick={resetExplicitly}>Explicit reset</button>
    <form id="fields" key={epoch} onSubmit={event => {
      event.preventDefault();
      trace.submitted = Object.fromEntries(new FormData(event.currentTarget));
    }}>
      {Array.from({ length: size }, (_, index) => mode === 'root'
        ? <ControlledField key={index} index={index} value={values[index]} onChange={event => {
          trace.fieldChanges++;
          const next = event.target.value;
          setValues(previous => previous.map((value, position) => position === index ? next : value));
        }} />
        : mode === 'local' ? <LocalField key={index} index={index} /> : <UncontrolledField key={index} index={index} />)}
      <button id="native-reset" type="reset">Native reset</button>
      <button id="read-form" type="submit">Read values</button>
    </form>
  </section>;
}
