import { browser } from '$app/environment';
import { getRequestEvent } from '$app/server';
import { PUBLIC_TYPEBASE_APP_URL } from '$env/static/public';
import { createTanstackQueryClient } from 'typebase-io/client';
import type { Router } from '../server/_generated/server';

export const client = createTanstackQueryClient<Router>({
	url: PUBLIC_TYPEBASE_APP_URL,
	fetch: (input, init) => {
		if (browser) {
			return fetch(input, init);
		}

		return getRequestEvent().fetch(input, init);
	}
});
