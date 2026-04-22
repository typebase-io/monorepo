export default function TodosSkeleton() {
  return (
    <>
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
    </>
  );
}
