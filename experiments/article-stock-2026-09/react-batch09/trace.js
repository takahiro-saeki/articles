export let trace = {};
export function resetTrace() {
  trace = { events: [], active: new Set(), formRenders: 0, fieldRenders: 0,
    fieldChanges: 0, calls: [], gates: [], submitted: null, errors: [] };
}
