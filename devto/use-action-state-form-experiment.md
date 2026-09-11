---
title: "Does useActionState preserve input? Nine comparisons with manual form state"
published: false
tags: react, javascript, forms, testing
canonical_url: null
---

`useActionState` manages an Action's result and pending status. It does not automatically preserve input values. In this fixture, returning a validation-error result still cleared the uncontrolled input.

The Action version was compared with ordinary onSubmit handling and useState, then a change to retain invalid input was tested. The state holding an Action result and the input that should remain after a failure each need a design decision.

## Call the same operation through an Action and onSubmit

This is the synthetic save operation. It sends no network request; browser test controls resolve its Promise. `trace` records call order and pending operations for the experiment.

```jsx
async function save(previous, formData) {
  const name = formData.get('name');
  trace.calls.push({ previous: { ...previous }, name });
  await new Promise(resolve => trace.gates.push(resolve));
  if (name === 'crash') throw new Error('simulated failure');
  if (name === 'bad') return { ...previous, message: 'invalid' };
  return { count: previous.count + 1, message: `saved:${name}` };
}
```

`good` returns success, `bad` returns a validation-error result, and `crash` throws. The first argument is `previous`, and the second is FormData.

The Action version receives state, formAction, and pending from `useActionState(save, initialState)`, then passes formAction to the form's action prop. Its input is uncontrolled with `defaultValue=""`. The [useActionState reference](https://react.dev/reference/react/useActionState) defines the previous-result argument and the pending return value.

The manual version calls the same save operation from onSubmit:

```jsx
async function onSubmit(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setPending(true);
    try { setState(await save(state, data)); }
    catch (error) { setState(previous => ({ ...previous, message: error.message })); }
    finally { setPending(false); }
  }
```

It also uses an uncontrolled input and does not call form.reset on success. It sets pending and result state explicitly and catches exceptions to produce a message. This minimal implementation shows which behavior is written manually; it is not a demonstration of a general limitation of useState.

## Returning an error result differed from throwing

The first comparison covered 6 conditions. Every submission showed pending as true and retained the entered text while the operation was held unresolved.

| Approach and input | Result at completion | Input after completion |
| --- | --- | --- |
| Action, good | count 1, saved:good | Empty |
| Manual, good | count 1, saved:good | good |
| Action, bad | count 0, invalid | Empty |
| Manual, bad | count 0, invalid | bad |
| Action, crash | Moves to Error Boundary | Form removed |
| Manual, crash | count 0, caught message | crash |

Although the Action returned `invalid` for `bad`, its Promise resolved normally. The uncontrolled-input reset after a successful Action, described in the [React form reference](https://react.dev/reference/react-dom/components/form), also occurred here. An application interpreting a return value as a validation error is different from the Action throwing.

An Error Boundary around the Action version displayed `simulated failure` instead of the form when save threw. The manual version catches the exception and stores a message, so it does not make the same display transition.

## Include the input that needs to survive in the result

This version was added to preserve input after a validation error:

```jsx
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
```

On validation failure, it returns the entered value and passes it to the input's `defaultValue`. On success, it returns an empty string. The additional 2 conditions retained `bad` after invalid input and cleared the field after `good`.

The input still is not controlled through `value`. Including the post-Action default in state preserves the required value after this reset. This is a fix verified inside the experiment, not a form already integrated into an existing application.

## Multiple calls wait for the previous result

Another condition dispatched twice from a separate button rather than through form submission:

```jsx
function queueTwo() {
    startTransition(() => {
      for (const name of ['first', 'second']) {
        const data = new FormData(); data.set('name', name); formAction(data);
      }
    });
  }
```

Until the first Promise resolved, only one save call was recorded. Resolving it started the second call, whose `previous.count` was `1`. The final state had count `2` and message `saved:second`.

| Observation point | Started save calls | Count on screen | pending |
| --- | --- | --- | --- |
| First call unresolved | 1 | 0 | true |
| First resolved, second unresolved | 2 | 0 | true |
| Both resolved | 2 | 2 | false |

In this experiment, the previous result passed to the next Action differed from the intermediate state already visible on screen. Both call history and DOM state were recorded.

React treats calls through the form action as a Transition. The direct button-dispatch comparison instead calls inside `startTransition`. Calls outside a Transition and designs expecting this Hook to execute operations in parallel were not tested.

## This experiment uses client functions only

The tests ran on September 11, 2026, with React and React DOM 19.3.0, Node.js 24.15.0, esbuild 0.28.2, macOS arm64, and Headless Chrome 152. A production build without Strict Mode or React Compiler covered 9 conditions. Pending operations were resolved manually; network latency was not measured.

The experiment excludes Server Functions, submissions before JavaScript loads, permalink behavior, authentication, and persistence. The official API also covers Server Function integration, but these results come from functions running in the browser. Server-side validation and authorization were neither implemented nor tested here.

The [comparison code](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/react-batch09/actions.jsx) and [results for the 9 conditions](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/production/2026-09/batch-09/browser-results.json) include whether inputs clear or remain and where thrown errors move the display, as well as pending status and return values.
