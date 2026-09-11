const events = [];
function open(name) {
  events.push(`open:${name}`);
  return { [Symbol.dispose]() { events.push(`close:${name}`); } };
}
function work() {
  using first = open('A');
  using second = open('B');
  events.push('body');
  return 'done';
}
const value = work();
console.log(JSON.stringify({ value, events }));
