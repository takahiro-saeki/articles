import { connection } from 'next/server';
import { readProbe } from '../../../lib/probe';
import RouterProbe from '../../../components/router-probe';
export default async function Page() {
  await connection();
  const value = await readProbe('router', 'no-store');
  return <main><h1>Router probe</h1><pre id="result">{JSON.stringify(value)}</pre><RouterProbe /></main>;
}
