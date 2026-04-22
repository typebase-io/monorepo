import { TYPEBASE_APP_URL } from '$env/static/private';
import { redirect } from '@sveltejs/kit';
import { getServerSession, proxyToTypebase } from 'typebase-io/client/auth/svelte-kit';

export async function handle({ event, resolve }) {
	const session = await getServerSession(event, TYPEBASE_APP_URL);

	if (event.url.pathname.startsWith('/api/auth') || event.url.pathname.startsWith('/rpc')) {
		return proxyToTypebase(event, TYPEBASE_APP_URL);
	}

	if (!session && event.url.pathname !== '/auth') {
		redirect(307, new URL('/auth', event.request.url));
	}

	if (session && event.url.pathname === '/auth') {
		redirect(307, new URL('/', event.request.url));
	}

	return resolve(event);
}
