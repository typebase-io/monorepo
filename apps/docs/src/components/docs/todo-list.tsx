import { Check } from 'lucide-react';
import Link from 'next/link';
import { type ReactNode, useId } from 'react';

import { cn } from '#lib/cn.ts';

export function TodoList({ children }: { children: ReactNode }) {
  return (
    <ul className="not-prose my-5 list-none divide-y divide-fd-border overflow-hidden rounded-xl border border-fd-border bg-fd-card/50 p-0 shadow-xs">
      {children}
    </ul>
  );
}

export function TodoItem({ checked = false, version, children }: { checked?: boolean; version?: string; children: ReactNode }) {
  const textId = useId();

  return (
    <li className="list-none px-4 py-3.5 sm:px-5">
      <div className="flex items-start gap-3.5">
        <span className="relative mt-0.5 flex size-5 shrink-0 items-center justify-center">
          <input
            type="checkbox"
            checked={checked}
            disabled
            aria-labelledby={textId}
            className="peer size-4.5 appearance-none rounded-[5px] border border-fd-muted-foreground/45 bg-fd-background shadow-xs transition-colors checked:border-fd-primary checked:bg-fd-primary"
          />
          <Check
            aria-hidden="true"
            strokeWidth={3}
            className="pointer-events-none absolute size-3.5 scale-75 text-fd-primary-foreground opacity-0 transition peer-checked:scale-100 peer-checked:opacity-100"
          />
        </span>
        <div
          id={textId}
          className={cn(
            'min-w-0 text-[0.95rem] leading-6 text-fd-foreground [&>p]:m-0',
            checked && 'text-fd-muted-foreground line-through decoration-fd-muted-foreground/60 decoration-1'
          )}
        >
          {children}
        </div>
        {version ? (
          <Link
            href={`/docs/changelog#v${version.replaceAll('.', '-')}`}
            className="ml-auto shrink-0 rounded-md border border-fd-border px-1.5 py-0.5 font-mono text-xs leading-5 text-fd-muted-foreground transition-colors hover:border-fd-primary/50 hover:text-fd-primary"
          >
            v{version}
          </Link>
        ) : null}
      </div>
    </li>
  );
}
