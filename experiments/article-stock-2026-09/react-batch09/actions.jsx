import React, { Component, startTransition, useActionState, useState } from 'react';
import { trace } from './trace.js';

const initialState = { count: 0, message: 'initial' };
async function save(previous, formData) {
  const name = formData.get('name');
  trace.calls.push({ previous: { ...previous }, name });
  await new Promise(resolve => trace.gates.push(resolve));
  if (name === 'crash') throw new Error('simulated failure');
  if (name === 'bad') return { ...previous, message: 'invalid' };
  return { count: previous.count + 1, message: `saved:${name}` };
}
export class ActionBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error: error.message }; }
  render() {
    return this.state.error ? <output id="action-error">{this.state.error}</output> : this.props.children;
  }
}
export function ActionExperiment() {
  const [state, formAction, pending] = useActionState(save, initialState);
  function queueTwo() {
    startTransition(() => {
      for (const name of ['first', 'second']) {
        const data = new FormData(); data.set('name', name); formAction(data);
      }
    });
  }
  return <section>
    <button id="queue-two" onClick={queueTwo}>Queue two</button>
    <output id="action-state">{JSON.stringify(state)}</output>
    <output id="action-pending">{String(pending)}</output>
    <form id="action-form" action={formAction}>
      <input id="action-input" name="name" defaultValue="" />
      <button id="action-submit" disabled={pending}>Save</button>
    </form>
  </section>;
}
export function ManualExperiment() {
  const [state, setState] = useState(initialState);
  const [pending, setPending] = useState(false);
  async function onSubmit(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setPending(true);
    try { setState(await save(state, data)); }
    catch (error) { setState(previous => ({ ...previous, message: error.message })); }
    finally { setPending(false); }
  }
  return <section>
    <output id="action-state">{JSON.stringify(state)}</output>
    <output id="action-pending">{String(pending)}</output>
    <form id="action-form" onSubmit={onSubmit}>
      <input id="action-input" name="name" defaultValue="" />
      <button id="action-submit" disabled={pending}>Save</button>
    </form>
  </section>;
}
async function saveWithInput(previous, formData) {
  const next = await save(previous, formData);
  return { ...next, input: next.message === 'invalid' ? String(formData.get('name')) : '' };
}
export function PreservingExperiment() {
  const [state, formAction, pending] = useActionState(saveWithInput, { ...initialState, input: '' });
  return <section>
    <output id="action-state">{JSON.stringify(state)}</output>
    <output id="action-pending">{String(pending)}</output>
    <form id="action-form" action={formAction}>
      <input id="action-input" name="name" defaultValue={state.input} />
      <button id="action-submit" disabled={pending}>Save</button>
    </form>
  </section>;
}
