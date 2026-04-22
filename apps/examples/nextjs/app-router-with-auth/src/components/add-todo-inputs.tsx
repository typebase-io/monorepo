'use client';

import { useFormStatus } from 'react-dom';

export default function AddTodoInputs() {
  const { pending } = useFormStatus();

  return (
    <>
      <input
        type="text"
        name="value"
        disabled={pending}
        placeholder="What needs to be done?"
        className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 placeholder-zinc-400 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder-zinc-500 dark:focus:border-zinc-400 disabled:opacity-50"
      />

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-zinc-900 px-5 py-2 font-medium text-white transition-colors enabled:hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:enabled:hover:bg-zinc-300 enabled:cursor-pointer disabled:opacity-50"
      >
        Add
      </button>
    </>
  );
}
