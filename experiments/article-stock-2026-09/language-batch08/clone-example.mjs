const row = { id: 'draft-1', status: 'ready' };
const source = {
  createdAt: new Date('2026-09-11T00:00:00.000Z'),
  counts: new Map([['ready', 2]]),
  memo: undefined,
  slots: [undefined],
  left: row,
  right: row,
};
const cloned = structuredClone(source);
const jsonCopy = JSON.parse(JSON.stringify(source));
console.log(cloned.createdAt instanceof Date, typeof jsonCopy.createdAt);
console.log(cloned.counts.get('ready'), jsonCopy.counts);
console.log(Object.hasOwn(cloned, 'memo'), Object.hasOwn(jsonCopy, 'memo'));
console.log(cloned.slots[0], jsonCopy.slots[0]);
console.log(cloned.left === cloned.right, jsonCopy.left === jsonCopy.right);
