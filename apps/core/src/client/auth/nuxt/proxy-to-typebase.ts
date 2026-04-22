import type { H3Event } from 'h3';
import { getRequestHeaders, getRequestURL, readRawBody } from 'h3';

export const proxyToTypebase = async (event: H3Event, typebaseAppUrl: string) => {
  const url = getRequestURL(event);
  const targetUrl = `${typebaseAppUrl}${url.pathname}${url.search}`;

  const headers = new Headers(getRequestHeaders(event) as Record<string, string>);

  headers.delete('host');
  headers.set('accept-encoding', 'identity');

  return fetch(targetUrl, {
    method: event.method,
    headers,
    body: event.method !== 'GET' && event.method !== 'HEAD' ? await readRawBody(event) : undefined,
  });
};
