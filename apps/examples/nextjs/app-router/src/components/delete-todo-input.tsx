'use client';

import { useFormStatus } from 'react-dom';

export default function DeleteTodoInput({ id }: { id: number }) {
  const { pending } = useFormStatus();

  return (
    <>
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={pending} className="text-zinc-400 dark:text-zinc-500 text-xl enabled:cursor-pointer">
        {pending ? '⏳' : '❌'}
      </button>
    </>
  );
}
