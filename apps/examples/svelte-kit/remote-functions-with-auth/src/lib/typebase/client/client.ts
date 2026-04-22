import { createRouterClient } from 'typebase-io/client';
import { getServerAuthCookie } from 'typebase-io/client/auth/svelte-kit';

import { getRequestEvent } from '$app/server';
import { TYPEBASE_APP_URL } from '$env/static/private';

import type { Router } from '../server/_generated/server';

export const client = createRouterClient<Router>({
	url: TYPEBASE_APP_URL,
	headers: async () => getServerAuthCookie(getRequestEvent())
});
