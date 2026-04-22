export function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded border border-fd-border bg-fd-card px-2 py-1 font-mono text-[11px] leading-none text-fd-foreground/80">
      {children}
    </span>
  );
}
