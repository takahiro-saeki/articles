export function GET(request) {
  return Response.json({ path: new URL(request.url).pathname });
}
