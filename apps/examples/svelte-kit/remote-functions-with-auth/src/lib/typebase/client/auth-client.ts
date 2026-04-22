import { browser } from '$app/environment';
import { getRequestEvent } from '$app/server';
import { createAuthClient } from 'typebase-io/client/auth/svelte';

export const authClient = createAuthClient({
	fetchOptions: {
		customFetchImpl: (url, request) => {
			if (browser) {
				return fetch(url, request);
			}

			return getRequestEvent().fetch(url, request);
		}
	}
});
