import { ServerError } from 'typebase-io/server';
import { action } from '../_generated/server';

export const authedAction = action.use(async ({ reqHeaders, auth }) => {
	if (!reqHeaders) {
		throw new ServerError('UNAUTHORIZED');
	}

	const sessionData = await auth.api.getSession({
		headers: reqHeaders
	});

	if (!sessionData?.session || !sessionData?.user) {
		throw new ServerError('UNAUTHORIZED');
	}

	return {
		user: sessionData.user
	};
});
