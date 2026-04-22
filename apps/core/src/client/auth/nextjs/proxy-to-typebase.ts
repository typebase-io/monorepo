import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export const proxyToTypebase = async (request: NextRequest, typebaseAppUrl: string) => {
  const url = new URL(request.url);
  const targetUrl = `${typebaseAppUrl}${url.pathname}${url.search}`;

  const headers = new Headers(request.headers);

  headers.delete('host');
  headers.set('accept-encoding', 'identity');

  const res = await fetch(targetUrl, {
    method: request.method,
    headers,
    body: request.method !== 'GET' && request.method !== 'HEAD' ? await request.arrayBuffer() : undefined,
  });

  return new NextResponse(res.body, {
    status: res.status,
    headers: res.headers,
  });
};
