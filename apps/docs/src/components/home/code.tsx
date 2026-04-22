export function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded border border-fd-primary/20 bg-fd-primary/10 px-1.5 py-0.5 font-mono text-[0.85em] text-fd-primary">{children}</code>
  );
}
