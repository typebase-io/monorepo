export function Pill({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center rounded border border-fd-border bg-fd-card px-2 py-1 font-mono text-[11px] leading-none text-fd-foreground/80 transition hover:border-fd-primary/50 hover:bg-fd-primary/10 hover:text-fd-foreground"
    >
      {children}
    </a>
  );
}
