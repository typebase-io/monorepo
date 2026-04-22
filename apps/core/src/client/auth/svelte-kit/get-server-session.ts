import type { RequestEvent } from '@sveltejs/kit';
import { type Session, type User } from 'better-auth';

export const getServerSession = async (event: RequestEvent, typebaseAppUrl: string) => {
  const cookie = event.request.headers.get('cookie');

  if (!cookie) {
    return null;
  }

  const res = await event.fetch(`${typebaseAppUrl}/api/auth/get-session`, {
    headers: { cookie },
  });

  if (!res.ok) {
    return null;
  }

  return res.json() as Promise<{ session: Session; user: User }>;
};
