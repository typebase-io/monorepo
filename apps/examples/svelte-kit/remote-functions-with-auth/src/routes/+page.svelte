<script lang="ts">
	import TodosSkeleton from '$lib/components/todos-skeleton.svelte';
	import Todos from '$lib/components/todos.svelte';
	import { addTodo, getTodos } from './actions.remote';

	const todos = getTodos();
</script>

<div class="flex flex-1 items-start justify-center bg-zinc-50 px-4 pt-24 dark:bg-black">
	<div class="w-full max-w-lg">
		<h1 class="mb-8 text-3xl font-bold text-zinc-900 dark:text-zinc-50">Todo App</h1>

		<form class="mb-8 flex gap-2" {...addTodo}>
			<input
				{...addTodo.fields.value.as('text')}
				disabled={addTodo.pending !== 0}
				placeholder="What needs to be done?"
				class="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 placeholder-zinc-400 outline-none focus:border-zinc-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder-zinc-500 dark:focus:border-zinc-400"
			/>

			<button
				type="submit"
				disabled={addTodo.pending !== 0}
				class="rounded-lg bg-zinc-900 px-5 py-2 font-medium text-white transition-colors enabled:cursor-pointer enabled:hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:enabled:hover:bg-zinc-300"
			>
				Add
			</button>
		</form>

		{#if todos.loading || todos.error}
			<TodosSkeleton />
		{:else}
			<Todos todos={todos.current || []} />
		{/if}
	</div>
</div>
