import { Bug, Database } from 'lucide-react';

export function RlsProblem() {
  return (
    <section className="relative overflow-hidden border-y border-fd-border bg-fd-background py-16 sm:py-24">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-40 top-1/3 h-112 w-md rounded-full bg-red-500/[0.07] blur-3xl" />
        <div className="absolute -right-32 bottom-0 h-96 w-[24rem] rounded-full bg-fd-primary/8 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgb(255 255 255 / 0.5) 1px, transparent 1px), linear-gradient(to bottom, rgb(255 255 255 / 0.5) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
          }}
        />
      </div>

      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="grid grid-cols-1 gap-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center lg:gap-20">
          <div className="min-w-0 lg:pr-4">
            <h2 className="mt-6 font-serif text-6xl italic leading-[0.95] tracking-tight text-fd-foreground sm:text-7xl lg:text-[5.5rem]">
              The problem
              <br />
              <span className="text-fd-primary">with RLS</span>
            </h2>

            <p className="mt-8 max-w-md text-base leading-relaxed text-fd-muted-foreground sm:text-lg">
              RLS is implicit and lives in a SQL dialect your editor doesn&rsquo;t typecheck. One{' '}
              <code className="rounded px-1 py-0.5 font-mono text-sm bg-orange-500/15 text-orange-300">UPDATE</code> policy gives write access to
              every column, including the ones you add tomorrow. The overly permissive clause an agent slipped in at 2am sails through review, because
              no compiler is going to flag it.
            </p>

            <div className="mt-8 flex items-center gap-3 text-sm">
              <span className="h-px flex-1 bg-fd-border" />
              <span className="font-mono text-xs uppercase tracking-[0.2em] text-fd-muted-foreground">vs.</span>
              <span className="h-px flex-1 bg-fd-border" />
            </div>

            <p className="mt-8 max-w-md text-base leading-relaxed text-fd-foreground/90 sm:text-lg">
              With Typebase, authorization is explicit. Your{' '}
              <code className="rounded bg-fd-primary/15 px-1.5 py-0.5 font-mono text-sm text-fd-primary">action</code> declares the columns it accepts
              and your auth check runs in code before any of them reach the database. Add a column, the compiler tells you who can write to it. The
              same code your agent writes is the code your compiler checks.
            </p>
          </div>

          <div className="relative">
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-6 -z-10 rounded-2xl bg-linear-to-br from-fd-primary/6 via-transparent to-red-500/6 blur-2xl"
            />

            <div className="overflow-hidden rounded-xl border border-fd-border bg-fd-card shadow-2xl shadow-black/40 backdrop-blur max-lg:w-max">
              <div className="flex items-center justify-between gap-3 border-b border-fd-border bg-fd-muted/40 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-400/60" />
                  <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/60" />
                  <span className="h-2.5 w-2.5 rounded-full bg-green-400/60" />
                  <span className="ml-3 hidden font-mono text-xs text-fd-muted-foreground sm:inline">app.supabase.com — auth / policies</span>
                </div>
                <span className="rounded bg-fd-primary/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-fd-primary">dashboard</span>
              </div>

              <div className="flex items-center gap-2 border-b border-fd-border px-4 py-3 text-xs text-fd-muted-foreground">
                <Database className="h-3.5 w-3.5" />
                <span>Authentication</span>
                <span className="text-fd-muted-foreground/50">›</span>
                <span>Policies</span>
                <span className="text-fd-muted-foreground/50">›</span>
                <span className="font-mono text-fd-foreground">public.todos</span>
                <span className="ml-auto whitespace-nowrap rounded border border-fd-border bg-fd-muted/30 px-2 py-0.5 font-mono text-[10px] text-fd-muted-foreground">
                  4 policies
                </span>
              </div>

              <div className="grid grid-cols-[1fr_72px_1fr_88px] gap-3 whitespace-nowrap bg-fd-muted/20 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-fd-muted-foreground">
                <span>Name</span>
                <span>Cmd</span>
                <span>Using expression</span>
                <span className="text-right">Status</span>
              </div>

              <div className="divide-y divide-fd-border">
                <RlsRow name="Enable read for all" role="public" cmd="SELECT" cmdClass="bg-blue-500/15 text-blue-300" expr="true" />
                <RlsRow
                  name="Users can update todos"
                  role="authenticated"
                  cmd="UPDATE"
                  cmdClass="bg-orange-500/15 text-orange-300"
                  expr="auth.role() = 'authenticated'"
                  warn
                />
                <RlsRow
                  name="Owners can delete"
                  role="authenticated"
                  cmd="DELETE"
                  cmdClass="bg-rose-500/15 text-rose-300"
                  expr="user_id = auth.uid()"
                />
                <RlsRow
                  name="Owners can insert"
                  role="authenticated"
                  cmd="INSERT"
                  cmdClass="bg-emerald-500/15 text-emerald-300"
                  expr="user_id = auth.uid()"
                />
              </div>
            </div>

            <div className="pointer-events-none absolute -bottom-6 left-1/2 w-[min(20rem,calc(100%-1.5rem))] -translate-x-1/2 rounded-lg border border-red-500/40 bg-fd-card/95 p-4 shadow-2xl shadow-red-950/40 backdrop-blur sm:left-auto sm:-right-6 sm:-bottom-8 sm:w-auto sm:max-w-[20rem] sm:translate-x-0">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-red-500/15 text-red-400">
                  <Bug className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-red-400">Insecure policy</span>
                    <span className="font-mono text-[10px] text-fd-muted-foreground">policy #2</span>
                  </div>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-fd-muted-foreground">
                    <span className="font-mono text-fd-foreground/90">auth.role() = &apos;authenticated&apos;</span> lets every signed-in user update
                    every column of every row.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function RlsRow({
  name,
  role,
  cmd,
  cmdClass,
  expr,
  warn,
}: {
  name: string;
  role: string;
  cmd: string;
  cmdClass: string;
  expr: string;
  warn?: boolean;
}) {
  return (
    <div
      className={`relative grid grid-cols-[1fr_72px_1fr_88px] items-center gap-3 whitespace-nowrap px-4 py-3 text-xs ${warn ? 'bg-red-500/8' : ''}`}
    >
      {warn ? <div className="absolute inset-y-0 left-0 w-0.5 bg-red-400" /> : null}
      <div>
        <div className="font-medium text-fd-foreground">{name}</div>
        <div className="mt-0.5 font-mono text-[10px] text-fd-muted-foreground">{role}</div>
      </div>
      <span className={`rounded px-1.5 py-0.5 text-center font-mono text-[10px] ${cmdClass}`}>{cmd}</span>
      <code className={`font-mono text-[10px] ${warn ? 'text-red-300' : 'text-fd-muted-foreground'}`}>{expr}</code>
      <div className="flex items-center justify-end gap-1.5 text-[10px]">
        <span className={`h-1.5 w-1.5 rounded-full ${warn ? 'bg-red-400' : 'bg-emerald-400'}`} />
        <span className={warn ? 'text-red-300' : 'text-emerald-400'}>{warn ? 'Active' : 'Active'}</span>
      </div>
    </div>
  );
}
