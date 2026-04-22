import { client } from '$lib/typebase/client/client';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent }) => {
	const { queryClient } = await parent();

	void queryClient.prefetchQuery(client.queries.todos.getMany.queryOptions());
};
