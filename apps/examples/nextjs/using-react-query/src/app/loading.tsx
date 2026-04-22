export default async function Loading() {
  return (
    <div className="flex flex-1 items-start justify-center bg-zinc-50 pt-24 px-4 dark:bg-black">
      <div className="w-full max-w-lg">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 mb-8">Todo App</h1>

        <div className="flex gap-2 mb-8">
          <input
            type="text"
            name="value"
            disabled
            placeholder="What needs to be done?"
            className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 placeholder-zinc-400 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder-zinc-500 dark:focus:border-zinc-400 disabled:opacity-50"
          />

          <button
            type="submit"
            disabled
            className="rounded-lg bg-zinc-900 px-5 py-2 font-medium text-white transition-colors enabled:hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:enabled:hover:bg-zinc-300 enabled:cursor-pointer disabled:opacity-50"
          >
            Add
          </button>
        </div>

        <ul className="space-y-2">
          {Array.from({ length: 5 }).map((_, idx) => (
            <li
              key={idx}
              className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex items-center w-full gap-3">
                <div className="h-4 w-4 rounded bg-zinc-200 animate-pulse dark:bg-zinc-700" />
                <div className="h-4 flex-1 rounded bg-zinc-200 animate-pulse dark:bg-zinc-700" style={{ maxWidth: `${50 + ((idx * 17) % 40)}%` }} />
              </div>
              <div className="h-9 w-5 flex items-center justify-center">
                <div className="h-5 w-5 rounded bg-zinc-200 animate-pulse dark:bg-zinc-700" />
              </div>
            </li>
          ))}
        </ul>

        <p className="mt-4 h-4 w-24 rounded bg-zinc-200 animate-pulse dark:bg-zinc-700" />
      </div>
    </div>
  );
}
