import { readProbe } from '../../../lib/probe';
export default async function Page() {
  const values = await Promise.all([readProbe('full', 'force-cache'), readProbe('full', 'force-cache')]);
  return <pre id="result">{JSON.stringify(values)}</pre>;
}
