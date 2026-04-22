<script lang="ts">
	import { client } from '$lib/typebase/client/client';
	import { createMutation, getQueryClientContext } from '@tanstack/svelte-query';

	const {
		todos
	}: {
		todos: { id: number; value: string; completed: boolean; createdAt: Date }[];
	} = $props();

	const queryClient = getQueryClientContext();
	const remainingTodos = $derived(todos.filter((t) => !t.completed));

	const toggleTodo = createMutation(() =>
		client.mutations.todos.toggle.mutationOptions({
			onSuccess: async () => {
				await queryClient.refetchQueries({
					queryKey: client.queries.todos.key()
				});
			}
		})
	);

	const deleteTodo = createMutation(() =>
		client.mutations.todos.deleteTodo.mutationOptions({
			onSuccess: async () => {
				await queryClient.refetchQueries({
					queryKey: client.queries.todos.key()
				});
			}
		})
	);
</script>

{#if todos.length === 0}
	<p class="text-center text-zinc-400 dark:text-zinc-500">No todos yet. Add one above!</p>
{:else}
	<ul class="space-y-2">
		{#each todos as todo (`${todo.id}-${todo.completed}`)}
			<li
				class="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900"
			>
				<button
					type="button"
					disabled={toggleTodo.isPending && toggleTodo.variables.id === todo.id}
					class="flex items-center justify-center enabled:cursor-pointer"
					aria-label="toggle todo"
					onclick={() => toggleTodo.mutate({ id: todo.id })}
				>
					<input
						type="checkbox"
						disabled={toggleTodo.isPending && toggleTodo.variables.id === todo.id}
						checked={todo.completed}
						readOnly
						tabIndex={-1}
						class="pointer-events-none h-4 w-4 accent-zinc-900 disabled:opacity-50 dark:accent-zinc-50"
					/>
				</button>

				<span
					class={`flex-1 ${todo.completed ? 'text-zinc-400 line-through dark:text-zinc-600' : 'text-zinc-900 dark:text-zinc-50'}`}
				>
					<div class="flex flex-col">
						<p>{todo.value}</p>
						<p class="text-sm text-zinc-400 dark:text-zinc-600">
							{todo.createdAt.toISOString().split('T')[0]}
						</p>
					</div>
				</span>

				<button
					type="button"
					disabled={deleteTodo.isPending && deleteTodo.variables.id === todo.id}
					class="text-xl text-zinc-400 enabled:cursor-pointer dark:text-zinc-500"
					onclick={() => deleteTodo.mutate({ id: todo.id })}
				>
					{deleteTodo.isPending && deleteTodo.variables.id === todo.id ? '⏳' : '❌'}
				</button>
			</li>
		{/each}
	</ul>
{/if}

{#if todos.length > 0}
	<p class="mt-4 text-sm text-zinc-400 dark:text-zinc-500">
		{remainingTodos.length} remaining
	</p>
{/if}
