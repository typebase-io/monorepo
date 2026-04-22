import { headers } from 'next/headers';

export const getServerAuthCookie = async () => {
  const h = await headers();
  const cookie = h.get('cookie');

  return cookie ? { cookie } : {};
};
