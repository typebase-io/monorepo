import { createRouterClient } from 'typebase-io/client';
import type { Router } from '../server/_generated/server';

export const client = createRouterClient<Router>({
  url: process.env.TYPEBASE_APP_URL_DEV ?? process.env.TYPEBASE_APP_URL ?? '',
});
