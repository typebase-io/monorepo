<script lang="ts">
	import { createMutation, getQueryClientContext } from '@tanstack/svelte-query';
	import { client } from '$lib/typebase/client/client';

	const queryClient = getQueryClientContext();

	let value = $state('');

	const createTodo = createMutation(() =>
		client.mutations.todos.create.mutationOptions({
			onSuccess: async () => {
				await queryClient.refetchQueries({
					queryKey: client.queries.todos.key()
				});

				value = '';
			}
		})
	);

	const handleSubmit = (evt: SubmitEvent & { currentTarget: EventTarget & HTMLFormElement }) => {
		evt.preventDefault();

		createTodo.mutate({ value: value.trim() });
	};
</script>

<form class="mb-8 flex gap-2" onsubmit={handleSubmit}>
	<input
		bind:value
		disabled={createTodo.isPending}
		placeholder="What needs to be done?"
		class="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 placeholder-zinc-400 outline-none focus:border-zinc-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder-zinc-500 dark:focus:border-zinc-400"
	/>

	<button
		type="submit"
		disabled={createTodo.isPending || value.trim().length === 0}
		class="rounded-lg bg-zinc-900 px-5 py-2 font-medium text-white transition-colors enabled:cursor-pointer enabled:hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:enabled:hover:bg-zinc-300"
	>
		Add
	</button>
</form>
