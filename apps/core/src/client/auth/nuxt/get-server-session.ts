import { type Session, type User } from 'better-auth';
import type { H3Event } from 'h3';
import { getHeader } from 'h3';

export const getServerSession = async (event: H3Event, typebaseAppUrl: string) => {
  const cookie = getHeader(event, 'cookie');

  if (!cookie) {
    return null;
  }

  const res = await fetch(`${typebaseAppUrl}/api/auth/get-session`, {
    headers: { cookie },
  });

  if (!res.ok) {
    return null;
  }

  return res.json() as Promise<{ session: Session; user: User }>;
};
