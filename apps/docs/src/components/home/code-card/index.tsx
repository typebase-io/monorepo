export function CodeCard({ title, label, children }: { title: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-fd-border bg-fd-card shadow-xl shadow-black/20">
      <div className="flex items-center justify-between border-b border-fd-border bg-fd-muted/40 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400/60" />
          <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/60" />
          <span className="h-2.5 w-2.5 rounded-full bg-green-400/60" />
          <span className="ml-3 font-mono text-xs text-fd-muted-foreground">{title}</span>
        </div>
        <span className="rounded bg-fd-primary/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-fd-primary">{label}</span>
      </div>
      <pre className="flex-1 overflow-x-auto p-5 font-mono text-[13px] leading-relaxed text-fd-foreground/90">
        <code>{children}</code>
      </pre>
    </div>
  );
}
