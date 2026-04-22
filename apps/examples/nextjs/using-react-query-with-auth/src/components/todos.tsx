'use client';

import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { client } from '../lib/typebase/client/client';

export default function Todos() {
  const { data: todos, refetch } = useSuspenseQuery(client.queries.todos.getMany.queryOptions());

  const toggleTodo = useMutation(
    client.mutations.todos.toggle.mutationOptions({
      onSuccess: async () => {
        await refetch();
      },
    })
  );

  const deleteTodo = useMutation(
    client.mutations.todos.deleteTodo.mutationOptions({
      onSuccess: async () => {
        await refetch();
      },
    })
  );

  return (
    <>
      {todos.length === 0 ? (
        <p className="text-center text-zinc-400 dark:text-zinc-500">No todos yet. Add one above!</p>
      ) : (
        <ul className="space-y-2">
          {todos.map((todo) => (
            <li
              key={todo.id}
              className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <button
                type="button"
                disabled={toggleTodo.isPending && toggleTodo.variables.id === todo.id}
                className="items-center justify-center flex enabled:cursor-pointer"
                onClick={() => toggleTodo.mutate({ id: todo.id })}
              >
                <input
                  key={String(todo.completed)}
                  type="checkbox"
                  disabled={toggleTodo.isPending && toggleTodo.variables.id === todo.id}
                  checked={todo.completed}
                  readOnly
                  tabIndex={-1}
                  className="h-4 w-4 accent-zinc-900 dark:accent-zinc-50 pointer-events-none disabled:opacity-50"
                />
              </button>

              <span className={`flex-1 ${todo.completed ? 'text-zinc-400 line-through dark:text-zinc-600' : 'text-zinc-900 dark:text-zinc-50'}`}>
                <div className="flex flex-col">
                  <p>{todo.value}</p>
                  <p className="text-sm text-zinc-400 dark:text-zinc-600">{todo.createdAt.toISOString().split('T')[0]}</p>
                </div>
              </span>

              <button
                type="button"
                disabled={deleteTodo.isPending && deleteTodo.variables.id === todo.id}
                className="text-zinc-400 dark:text-zinc-500 text-xl enabled:cursor-pointer"
                onClick={() => deleteTodo.mutate({ id: todo.id })}
              >
                {deleteTodo.isPending && deleteTodo.variables.id === todo.id ? '⏳' : '❌'}
              </button>
            </li>
          ))}
        </ul>
      )}

      {todos.length > 0 && <p className="mt-4 text-sm text-zinc-400 dark:text-zinc-500">{todos.filter((t) => !t.completed).length} remaining</p>}
    </>
  );
}
