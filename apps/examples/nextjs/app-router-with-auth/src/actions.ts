'use server';

import { revalidatePath } from 'next/cache';
import { client } from './lib/typebase/client/client';

export async function addTodo(formData: FormData) {
  const value = formData.get('value') as string;

  await client.mutations.todos.create({ value: value.trim() });

  revalidatePath('/');
}

export async function toggleTodo(formData: FormData) {
  const id = Number(formData.get('id'));

  await client.mutations.todos.toggle({ id });

  revalidatePath('/');
}

export async function deleteTodo(formData: FormData) {
  const id = Number(formData.get('id'));

  await client.mutations.todos.deleteTodo({ id });

  revalidatePath('/');
}
