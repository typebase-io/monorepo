import type { ReactNode } from 'react';

export function SectionLabel({ children, number }: { children: ReactNode; number: string }) {
  return (
    <p className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.16em] text-fd-primary sm:text-xs">
      <span className="text-fd-muted-foreground">{number}</span>
      <span aria-hidden="true" className="h-px w-6 bg-fd-primary/40" />
      {children}
    </p>
  );
}
