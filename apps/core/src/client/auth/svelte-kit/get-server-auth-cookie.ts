import type { RequestEvent } from '@sveltejs/kit';

export const getServerAuthCookie = (event: RequestEvent) => {
  const cookie = event.request.headers.get('cookie');
  return { cookie: cookie ?? undefined };
};
