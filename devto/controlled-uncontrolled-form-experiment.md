---
title: "Controlled input work depends on state placement: compare 10, 100, and 500 fields"
published: false
tags: react, javascript, performance, testing
canonical_url: null
---

Field count alone does not determine whether a form should use controlled or uncontrolled inputs. Even with controlled inputs, placing state in each field meant editing one field invoked only one input component.

The experiment compared parent-owned values, field-local state, and DOM-owned values across forms with 10, 100, and 500 fields. Reducing repeated component work requires looking at state placement as well as whether inputs are controlled.

## Count component calls for the same input operation

These are the three field components. `trace` is an experiment counter, not application state.

```jsx
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
```

The parent-owned version keeps a `values` array in state, replaces the changed position, and passes values to every input. The local version updates state inside `LocalField`. The uncontrolled version supplies an initial `defaultValue` and reads values through FormData on submission.

Field count and order stay fixed within each condition. The fixture uses position keys and does not delete, insert, or reorder fields.

Each input has a distinct name. A browser fill operation replaced the first field's `field-0` value with `edited`. This was not a character-by-character typing test. Both controlled versions recorded one onChange call for that operation.

The measurement is the additional component-function calls caused by the edit, excluding initial rendering.

| State placement | Fields | Additional parent-form calls | Additional input-component calls |
| --- | --- | --- | --- |
| Parent-owned | 10 | 1 | 10 |
| Parent-owned | 100 | 1 | 100 |
| Parent-owned | 500 | 1 | 500 |
| Field-local state | 10 | 0 | 1 |
| Field-local state | 100 | 0 | 1 |
| Field-local state | 500 | 0 | 1 |
| DOM-owned | 10 | 0 | 0 |
| DOM-owned | 100 | 0 | 0 |
| DOM-owned | 500 | 0 | 0 |

The production build used no React Compiler, memo, or Strict Mode. The table therefore compares the same unoptimized structure. Zero input-component calls does not mean the browser performs no input or painting work. Execution time, FPS, and memory use were not measured.

The [React input reference](https://react.dev/reference/react-dom/components/input) describes updating a controlled value in onChange and moving state to the part of the tree that needs it. The observed results also show that controlled inputs do not inherently require the entire parent to rerun.

## Verify collected values too

All 9 conditions produced as many FormData entries as there were fields, with `edited` as the first value after editing. This did not aggregate all field-local values into parent React state simultaneously. It collected values already reflected in the DOM using the submission method chosen for this experiment.

Immediate previews of all fields or validation across fields require an additional decision about where values are read. This fixture contains independent text inputs only. It excludes form libraries, IME composition, and asynchronous validation.

## The same reset button produced different outcomes

After editing, pressing a `type="reset"` button left `edited` in both controlled versions. The uncontrolled version returned to `field-0`.

| Approach | After HTML reset | Explicit reset method used in the experiment |
| --- | --- | --- |
| Parent state | edited | Set state to an array of initial values |
| Field-local state | edited | Change the form key to remount it |
| Uncontrolled | field-0 | Call form.reset() |

Changing the key in the field-local version tests whether remounting restores initial values. Remounting also recreates component state below that point. It should not be applied unchanged when a reset must preserve focus or other state.

After an explicit reset, all three approaches showed `field-0` in the first field. Treat native reset and React state initialization as separate operations, then verify reset behavior for the chosen value ownership. The [form reference](https://react.dev/reference/react-dom/components/form) also covers event-based submission and reading values with FormData.

The tests ran on September 11, 2026, with React and React DOM 19.3.0, Node.js 24.15.0, esbuild 0.28.2, macOS arm64, and Headless Chrome 152. The [complete form fixture](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/react-batch09/forms.jsx) and [results for the 9 conditions](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/production/2026-09/batch-09/browser-results.json) are available. These results do not establish that 500 fields always require uncontrolled inputs. Choose with both the values React needs during editing and the submission/reset behavior in view.
