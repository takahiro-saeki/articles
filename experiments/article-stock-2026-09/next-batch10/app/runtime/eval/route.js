export const runtime = 'nodejs';
export function GET() { return Response.json({ value: eval('1 + 2') }); }
