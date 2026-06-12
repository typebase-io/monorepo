export function CodeCard({ title, label, children }: { title: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-fd-border bg-fd-card shadow-xl shadow-black/20">
      <div className="flex items-center justify-between gap-3 border-b border-fd-border bg-fd-muted/40 px-4 py-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-red-400/60" />
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-yellow-400/60" />
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-green-400/60" />
          <span dir="rtl" className="ml-3 min-w-0 flex-1 truncate text-left font-mono text-xs text-fd-muted-foreground">
            &lrm;{title}&lrm;
          </span>
        </div>
        <span className="shrink-0 rounded bg-fd-primary/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-fd-primary">{label}</span>
      </div>
      <pre className="flex-1 overflow-x-auto py-5 font-mono text-[13px] leading-relaxed text-fd-foreground/90">
        <code className="block w-max min-w-full px-5">{children}</code>
      </pre>
    </div>
  );
}
