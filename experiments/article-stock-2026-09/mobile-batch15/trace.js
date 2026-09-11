import { AppState, Linking } from 'react-native';

const boot = Date.now().toString(36);
let sequence = 0;
export function trace(event, data = {}) {
  const record = { boot, sequence: ++sequence, event, data, elapsed: performance.now() };
  console.log('ARTICLE_B15', JSON.stringify(record));
  void fetch('http://127.0.0.1:9915/event', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(record),
  }).catch(error => console.warn('Local probe collector unavailable', error.message));
}
trace('module', { currentState: AppState.currentState });
export const initialURL = Linking.getInitialURL().then(url => {
  trace('initial-url', { url });
  return url;
});
