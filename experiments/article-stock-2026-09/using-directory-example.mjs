import { existsSync, mkdtempDisposableSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let path;
try {
  using temporary = mkdtempDisposableSync(join(tmpdir(), 'article-using-example-'));
  path = temporary.path;
  writeFileSync(join(path, 'sample.txt'), 'fixture');
  console.log('inside:', existsSync(path));
  throw new Error('work failed');
} catch (error) {
  console.log('caught:', error.message);
}
console.log('after:', existsSync(path));
