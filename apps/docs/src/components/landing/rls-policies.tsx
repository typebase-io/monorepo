import { Database, TriangleAlert } from 'lucide-react';

const policies = [
  {
    name: 'Enable read for all',
    role: 'public',
    cmd: 'SELECT',
    tone: 'bg-sky-500/15 text-sky-300',
    expr: 'true',
  },
  {
    name: 'Users can update todos',
    role: 'authenticated',
    cmd: 'UPDATE',
    tone: 'bg-orange-500/15 text-orange-300',
    expr: "auth.role() = 'authenticated'",
    warn: true,
  },
  {
    name: 'Owners can delete',
    role: 'authenticated',
    cmd: 'DELETE',
    tone: 'bg-rose-500/15 text-rose-300',
    expr: 'user_id = auth.uid()',
  },
];

const columns = 'grid grid-cols-[1fr_74px_minmax(0,1.15fr)] gap-3';

export function RlsPolicies() {
  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden rounded-lg border border-fd-primary/25 bg-fd-muted/30">
      <div className="flex items-center justify-between gap-3 border-b border-fd-border px-4 py-3 sm:px-5">
        <span className="flex min-w-0 items-center gap-2">
          <span aria-hidden className="size-2.5 shrink-0 rounded-full bg-red-400/60" />
          <span aria-hidden className="size-2.5 shrink-0 rounded-full bg-yellow-400/60" />
          <span aria-hidden className="size-2.5 shrink-0 rounded-full bg-green-400/60" />
          <span className="ml-2 truncate font-mono text-[10px] text-fd-muted-foreground sm:text-xs">app.supabase.com / auth / policies</span>
        </span>
        <span className="shrink-0 rounded bg-fd-primary/15 px-2 py-0.5 font-mono text-[10px] tracking-wider text-fd-primary uppercase">
          SQL policy
        </span>
      </div>

      <div className="flex items-center gap-2 border-b border-fd-border px-4 py-3 text-xs text-fd-muted-foreground sm:px-5">
        <Database aria-hidden className="size-3.5 shrink-0" />
        <span className="truncate">
          Authentication <span className="text-fd-muted-foreground/50">›</span> Policies <span className="text-fd-muted-foreground/50">›</span>{' '}
          <span className="font-mono text-fd-foreground">public.todos</span>
        </span>
      </div>

      <div className="flex-1 overflow-x-auto">
        <div className="min-w-125">
          <div className={`${columns} bg-fd-muted/40 px-4 py-2 font-medium text-[10px] tracking-wider text-fd-muted-foreground uppercase sm:px-5`}>
            <span>Name</span>
            <span>Cmd</span>
            <span>Using expression</span>
          </div>
          <div className="divide-y divide-fd-border">
            {policies.map((policy) => (
              <div key={policy.name} className={`${columns} relative items-center px-4 py-3 text-xs sm:px-5 ${policy.warn ? 'bg-red-500/8' : ''}`}>
                {policy.warn ? <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-red-400" /> : null}
                <span className="min-w-0">
                  <span className="block whitespace-nowrap">{policy.name}</span>
                  <span className="mt-0.5 block font-mono text-[10px] text-fd-muted-foreground">{policy.role}</span>
                </span>
                <span className={`w-fit rounded px-1.5 py-0.5 font-mono text-[10px] ${policy.tone}`}>{policy.cmd}</span>
                <code className={`min-w-0 whitespace-nowrap font-mono text-[10px] ${policy.warn ? 'text-red-300' : 'text-fd-muted-foreground'}`}>
                  {policy.expr}
                </code>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="flex items-start gap-3 border-t border-red-500/30 bg-red-500/8 px-4 py-4 text-xs leading-5 text-fd-muted-foreground sm:px-5">
        <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-red-400" />
        <span>
          <span className="font-medium text-red-400">Policy 2 passes for anyone signed in.</span> Bob can update Alice’s row, in every column, plus
          any column you add later. No type checker reads this.
        </span>
      </p>
    </div>
  );
}
