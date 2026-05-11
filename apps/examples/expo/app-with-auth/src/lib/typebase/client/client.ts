import { createTanstackQueryClient } from 'typebase-io/client';
import type { Router } from '../server/_generated/server';
import { authClient } from './auth-client';

export const client = createTanstackQueryClient<Router>({
  url: process.env.EXPO_PUBLIC_TYPEBASE_APP_URL || '',
  headers: () => {
    return { cookie: authClient.getCookie() };
  },
});
