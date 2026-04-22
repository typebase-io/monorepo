import { form, query } from '$app/server';
import { client } from '$lib/typebase/client/client';
import z from 'zod';

export const getTodos = query(async () => {
	return client.queries.todos.getMany();
});

export const addTodo = form(z.object({ value: z.string() }), async ({ value }) => {
	await client.mutations.todos.create({ value });

	void getTodos().refresh();
});

export const toggleTodo = form(z.object({ id: z.number() }), async ({ id }) => {
	await client.mutations.todos.toggle({ id });

	void getTodos().refresh();
});

export const deleteTodo = form(z.object({ id: z.number() }), async ({ id }) => {
	await client.mutations.todos.deleteTodo({ id });

	void getTodos().refresh();
});
