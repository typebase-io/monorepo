import { form } from '$app/server';
import { authClient } from '$lib/typebase/client/auth-client';
import { invalid, redirect } from '@sveltejs/kit';
import z from 'zod';

export const signIn = form(
	z.object({ email: z.string(), password: z.string() }),
	async ({ email, password }, issue) => {
		const response = await authClient.signIn.email({
			email,
			password
		});

		if (response.error) {
			invalid(issue.email(response.error.message || response.error.code || 'Unknown error'));
		}

		redirect(307, '/');
	}
);

export const signUp = form(
	z.object({ name: z.string(), email: z.string(), password: z.string() }),
	async ({ name, email, password }, issue) => {
		const response = await authClient.signUp.email({
			name,
			email,
			password
		});

		if (response.error) {
			invalid(issue.email(response.error.message || response.error.code || 'Unknown error'));
		}

		redirect(307, '/');
	}
);

export const signOut = form('unchecked', async (_, issue) => {
	const response = await authClient.signOut();

	if (response.error) {
		invalid(issue.email(response.error.message || response.error.code || 'Unknown error'));
	}

	redirect(307, '/auth');
});
