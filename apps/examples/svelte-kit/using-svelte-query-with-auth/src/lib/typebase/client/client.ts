import { browser } from '$app/environment';
import { PUBLIC_TYPEBASE_APP_URL } from '$env/static/public';
import { createTanstackQueryClient } from 'typebase-io/client';
import type { Router } from '../server/_generated/server';

export const client = createTanstackQueryClient<Router>({
	url: browser ? window.location.origin : PUBLIC_TYPEBASE_APP_URL
});
