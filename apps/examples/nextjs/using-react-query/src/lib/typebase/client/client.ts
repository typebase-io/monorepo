import { createTanstackQueryClient } from 'typebase-io/client';
import type { Router } from '../server/_generated/server';

export const client = createTanstackQueryClient<Router>({
  url: process.env.NEXT_PUBLIC_TYPEBASE_APP_URL ?? '',
});
