import type { H3Event } from 'h3';
import { getHeader } from 'h3';

export const getServerAuthCookie = (event: H3Event) => {
  const cookie = getHeader(event, 'cookie');

  return { cookie: cookie ?? undefined };
};
