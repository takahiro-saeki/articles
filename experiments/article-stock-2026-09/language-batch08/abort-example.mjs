import { delay } from './cancellable-delay.mjs';

const controller = new AbortController();
const group = Promise.allSettled([
  delay(10000, controller.signal),
  delay(10000, controller.signal),
]);
const reason = new Error('screen closed');
controller.abort(reason);
const results = await group;
console.log(results.map(result => result.status));
console.log(results.every(result => result.reason === reason));
