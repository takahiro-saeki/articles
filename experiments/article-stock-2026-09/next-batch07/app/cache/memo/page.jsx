import { connection } from 'next/server';
import { readProbe } from '../../../lib/probe';
export default async function Page() {
  await connection();
  const values = await Promise.all([readProbe('memo', 'no-store'), readProbe('memo', 'no-store')]);
  return <pre id="result">{JSON.stringify(values)}</pre>;
}
