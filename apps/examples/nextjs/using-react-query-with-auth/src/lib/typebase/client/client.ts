import { createTanstackQueryClient } from 'typebase-io/client';
import { getServerAuthCookie } from 'typebase-io/client/auth/nextjs';
import type { Router } from '../server/_generated/server';

export const client = createTanstackQueryClient<Router>({
  url: typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_TYPEBASE_APP_URL ?? ''),
  headers: async () => {
    if (typeof window !== 'undefined') {
      return {};
    }

    return await getServerAuthCookie();
  },
});
