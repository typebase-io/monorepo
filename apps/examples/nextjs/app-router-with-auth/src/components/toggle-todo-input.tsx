'use client';

import { useFormStatus } from 'react-dom';

export default function ToggleTodoInput({ todo }: { todo: { id: number; completed: boolean } }) {
  const { pending } = useFormStatus();

  return (
    <>
      <input type="hidden" name="id" value={todo.id} />
      <button type="submit" disabled={pending} className="items-center justify-center flex enabled:cursor-pointer">
        <input
          key={String(todo.completed)}
          type="checkbox"
          disabled={pending}
          checked={todo.completed}
          readOnly
          tabIndex={-1}
          className="h-4 w-4 accent-zinc-900 dark:accent-zinc-50 pointer-events-none disabled:opacity-50"
        />
      </button>
    </>
  );
}
