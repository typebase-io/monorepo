<script lang="ts">
	import TodosSkeleton from '$lib/components/todos-skeleton.svelte';
	import Todos from '$lib/components/todos.svelte';
	import { client } from '$lib/typebase/client/client';
	import { createQuery } from '@tanstack/svelte-query';
	import AddTodoForm from '../lib/components/add-todo-form.svelte';

	const todos = createQuery(() => client.queries.todos.getMany.queryOptions());
</script>

<div class="flex flex-1 items-start justify-center bg-zinc-50 px-4 pt-24 dark:bg-black">
	<div class="w-full max-w-lg">
		<h1 class="mb-8 text-3xl font-bold text-zinc-900 dark:text-zinc-50">Todo App</h1>

		<AddTodoForm />

		{#if todos.isPending || todos.error}
			<TodosSkeleton />
		{:else}
			<Todos todos={todos.data} />
		{/if}
	</div>
</div>
