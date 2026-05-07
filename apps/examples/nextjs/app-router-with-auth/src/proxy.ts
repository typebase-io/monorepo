import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServerSession, proxyToTypebase } from 'typebase-io/client/auth/nextjs';

export async function proxy(request: NextRequest) {
  const session = await getServerSession(process.env.TYPEBASE_APP_URL_DEV ?? process.env.TYPEBASE_APP_URL ?? '');
  const requestUrl = new URL(request.url);

  if (requestUrl.pathname.startsWith('/api/auth')) {
    return proxyToTypebase(request, process.env.TYPEBASE_APP_URL_DEV ?? process.env.TYPEBASE_APP_URL ?? '');
  }

  if (!session && requestUrl.pathname !== '/auth') {
    return NextResponse.redirect(new URL('/auth', request.url));
  }

  if (session && requestUrl.pathname === '/auth') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|.*\\.png$).*)'],
};
