'use client';

import { Plus } from 'lucide-react';
import { type ReactNode, useId, useState } from 'react';

export function FaqItem({ question, children }: { question: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const answerId = useId();

  return (
    <div className="border-b border-fd-border py-5">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={answerId}
          onClick={() => {
            setOpen((current) => !current);
          }}
          className="flex w-full cursor-pointer items-center justify-between gap-5 text-left text-base font-medium hover:text-fd-primary focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-fd-primary"
        >
          {question}
          <Plus
            aria-hidden="true"
            className={`size-4 shrink-0 text-fd-primary transition-transform duration-300 ease-in-out motion-reduce:transition-none ${open ? 'rotate-45' : 'rotate-0'}`}
          />
        </button>
      </h3>
      <div
        id={answerId}
        inert={!open}
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out motion-reduce:transition-none ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
      >
        <div className="min-h-0 overflow-hidden">
          <p className="max-w-xl pt-3 pr-5 text-sm leading-6 text-fd-muted-foreground">{children}</p>
        </div>
      </div>
    </div>
  );
}
