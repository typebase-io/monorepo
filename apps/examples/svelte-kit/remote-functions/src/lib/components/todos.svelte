<script lang="ts">
	import { deleteTodo, toggleTodo } from '../../routes/actions.remote';

	const {
		todos
	}: {
		todos: { id: number; value: string; completed: boolean; createdAt: Date }[];
	} = $props();

	const remainingTodos = $derived(todos.filter((t) => !t.completed));
</script>

{#if todos.length === 0}
	<p class="text-center text-zinc-400 dark:text-zinc-500">No todos yet. Add one above!</p>
{:else}
	<ul class="space-y-2">
		{#each todos as todo (`${todo.id}-${todo.completed}`)}
			{@const toggle = toggleTodo.for(todo.id)}
			{@const deleteTodoAction = deleteTodo.for(todo.id)}

			<li
				class="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900"
			>
				<form {...toggle}>
					<input {...toggle.fields.id.as('number', todo.id)} type="hidden" />
					<button
						type="submit"
						disabled={toggle.pending !== 0}
						class="flex items-center justify-center enabled:cursor-pointer"
						aria-label="toggle todo"
					>
						<input
							type="checkbox"
							disabled={toggle.pending !== 0}
							checked={todo.completed}
							readOnly
							tabIndex={-1}
							class="pointer-events-none h-4 w-4 accent-zinc-900 disabled:opacity-50 dark:accent-zinc-50"
						/>
					</button>
				</form>

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

				<form {...deleteTodoAction}>
					<input {...deleteTodoAction.fields.id.as('number', todo.id)} type="hidden" />
					<button
						type="submit"
						disabled={deleteTodoAction.pending !== 0}
						class="text-xl text-zinc-400 enabled:cursor-pointer dark:text-zinc-500"
					>
						{deleteTodoAction.pending !== 0 ? '⏳' : '❌'}
					</button>
				</form>
			</li>
		{/each}
	</ul>
{/if}

{#if todos.length > 0}
	<p class="mt-4 text-sm text-zinc-400 dark:text-zinc-500">
		{remainingTodos.length} remaining
	</p>
{/if}
