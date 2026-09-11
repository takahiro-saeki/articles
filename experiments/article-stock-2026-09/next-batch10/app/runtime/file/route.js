import { readFixture } from '../../../lib/node-file';
export const runtime = 'nodejs';
export async function GET() { return Response.json({ text: await readFixture() }); }
