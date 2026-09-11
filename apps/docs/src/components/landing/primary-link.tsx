import Link from 'next/link';
import type { ReactNode } from 'react';

import { cn } from '#lib/cn.ts';

export function PrimaryLink({
  children,
  href = '/docs/getting-started',
  className = '',
}: {
  children: ReactNode;
  href?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex min-h-11 items-center justify-center rounded-md bg-fd-primary px-5 py-3 text-sm font-semibold text-fd-primary-foreground transition-colors hover:bg-fd-secondary-foreground',
        className
      )}
    >
      {children}
    </Link>
  );
}
