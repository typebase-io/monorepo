import type { RequestEvent } from '@sveltejs/kit';

export const proxyToTypebase = async (event: RequestEvent, typebaseAppUrl: string): ReturnType<RequestEvent['fetch']> => {
  const targetUrl = `${typebaseAppUrl}${event.url.pathname}${event.url.search}`;

  const headers = new Headers(event.request.headers);

  headers.delete('host');
  headers.set('accept-encoding', 'identity');

  return event.fetch(targetUrl, {
    method: event.request.method,
    headers,
    body: event.request.method !== 'GET' && event.request.method !== 'HEAD' ? await event.request.arrayBuffer() : undefined,
  });
};
