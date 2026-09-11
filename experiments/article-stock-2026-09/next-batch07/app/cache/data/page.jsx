import { connection } from 'next/server';
import { readProbe } from '../../../lib/probe';
export default async function Page() {
  await connection();
  const values = await Promise.all([readProbe('data', 'force-cache'), readProbe('data', 'force-cache')]);
  return <pre id="result">{JSON.stringify(values)}</pre>;
}
