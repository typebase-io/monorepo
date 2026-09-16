import { File as BaseFile, Files as BaseFiles, Folder as BaseFolder } from 'fumadocs-ui/components/files';
import type { ComponentProps, ReactNode } from 'react';

import { cn } from '#lib/cn.ts';

function annotate(name: string, comment?: string): string {
  if (!comment) return name;

  return (
    <>
      {name}
      <span className="font-mono text-xs italic text-fd-muted-foreground">{comment}</span>
    </>
  ) as unknown as string;
}

export function File({ name, comment }: { name: string; comment?: string }) {
  return <BaseFile name={annotate(name, comment)} className="whitespace-nowrap hover:bg-transparent hover:text-current" />;
}

export function Folder({ name, comment, defaultOpen, children }: { name: string; comment?: string; defaultOpen?: boolean; children?: ReactNode }) {
  return (
    <BaseFolder
      name={annotate(name, comment)}
      defaultOpen={defaultOpen}
      disabled
      className="[&>[data-state=open]]:overflow-visible [&>button]:whitespace-nowrap [&>button]:hover:bg-transparent [&>button]:hover:text-current"
    >
      {children}
    </BaseFolder>
  );
}

export function Files({ className, children, ...props }: ComponentProps<typeof BaseFiles>) {
  return (
    <BaseFiles className={cn('overflow-x-auto', className)} {...props}>
      <div className="w-max min-w-full">{children}</div>
    </BaseFiles>
  );
}
