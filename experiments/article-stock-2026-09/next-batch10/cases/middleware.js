import { NextResponse } from 'next/server';
export function middleware(request) {
  const response = NextResponse.next();
  response.headers.set('x-article-proxy', request.nextUrl.pathname);
  return response;
}
export const config = { matcher: ['/protected/:path*'] };
