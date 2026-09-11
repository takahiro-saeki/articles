import { readFixture } from '../../../lib/node-file';
export const runtime = 'edge';
export async function GET() { return Response.json({ text: await readFixture() }); }
