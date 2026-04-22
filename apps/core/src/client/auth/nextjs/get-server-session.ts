import { type Session, type User } from 'better-auth';
import { headers } from 'next/headers';

export const getServerSession = async (typebaseAppUrl: string) => {
  const h = await headers();
  const cookie = h.get('cookie');

  if (!cookie) {
    return null;
  }

  const res = await fetch(`${typebaseAppUrl}/api/auth/get-session`, {
    headers: { cookie },
    cache: 'no-store',
  });

  if (!res.ok) {
    return null;
  }

  return res.json() as Promise<{ session: Session; user: User }>;
};
