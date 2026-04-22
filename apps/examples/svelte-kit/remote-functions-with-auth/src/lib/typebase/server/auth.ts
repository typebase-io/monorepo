import { defineAuth } from 'typebase-io/server';

export const auth = defineAuth({
	trustedOrigins: ['http://localhost:5173'],
	emailAndPassword: {
		enabled: true
	}
});
