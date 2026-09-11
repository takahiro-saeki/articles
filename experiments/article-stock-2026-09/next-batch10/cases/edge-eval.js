export const runtime = 'edge';
export function GET() { return Response.json({ value: eval('1 + 2') }); }
