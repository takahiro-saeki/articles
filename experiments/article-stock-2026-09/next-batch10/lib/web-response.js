export async function webResponse(request) {
  const text = new URL(request.url).searchParams.get('text') ?? '';
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const hex = Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, '0')).join('');
  return Response.json({ text, bytes: data.length, sha256: hex });
}
