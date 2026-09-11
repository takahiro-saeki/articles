import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
export async function readFixture() {
  return (await readFile(join(process.cwd(), 'fixture.txt'), 'utf8')).trim();
}
