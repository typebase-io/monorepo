import { TYPEBASE_APP_URL } from '$env/static/private';
import { createRouterClient } from 'typebase-io/client';
import type { Router } from '../server/_generated/server';

export const client = createRouterClient<Router>({
	url: TYPEBASE_APP_URL
});
