// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces

import type { AuthSession } from './lib/typebase/server/_generated/db.d.ts';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			session: AuthSession['session'] | null;
			user: AuthSession['user'] | null;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
