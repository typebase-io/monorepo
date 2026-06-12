import { File as BaseFile, Files as BaseFiles, Folder as BaseFolder } from 'fumadocs-ui/components/files';
import type { ReactNode } from 'react';

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
  return <BaseFile name={annotate(name, comment)} className="hover:bg-transparent hover:text-current" />;
}

export function Folder({ name, comment, defaultOpen, children }: { name: string; comment?: string; defaultOpen?: boolean; children?: ReactNode }) {
  return (
    <BaseFolder
      name={annotate(name, comment)}
      defaultOpen={defaultOpen}
      disabled
      className="[&>button]:hover:bg-transparent [&>button]:hover:text-current"
    >
      {children}
    </BaseFolder>
  );
}

export { BaseFiles as Files };
