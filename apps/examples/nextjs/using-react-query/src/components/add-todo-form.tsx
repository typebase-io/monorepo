'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { client } from '../lib/typebase/client/client';
import { useState, type SubmitEvent } from 'react';

export default function AddTodoForm() {
  const queryClient = useQueryClient();
  const [value, setValue] = useState('');

  const addTodo = useMutation(
    client.mutations.todos.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: client.queries.todos.key(),
        });

        setValue('');
      },
    })
  );

  const onSubmit = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();

    addTodo.mutate({ value: value.trim() });
  };

  return (
    <form className="flex gap-2 mb-8" onSubmit={onSubmit}>
      <input
        type="text"
        name="value"
        value={value}
        onChange={(e) => setValue(e.currentTarget.value)}
        disabled={addTodo.isPending}
        placeholder="What needs to be done?"
        className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 placeholder-zinc-400 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder-zinc-500 dark:focus:border-zinc-400 disabled:opacity-50"
      />

      <button
        type="submit"
        disabled={addTodo.isPending || !value.trim()}
        className="rounded-lg bg-zinc-900 px-5 py-2 font-medium text-white transition-colors enabled:hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:enabled:hover:bg-zinc-300 enabled:cursor-pointer disabled:opacity-50"
      >
        Add
      </button>
    </form>
  );
}
