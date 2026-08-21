import { FolderExplorer } from '#components/home/folder-explorer.tsx';

const steps = [
  {
    number: '01',
    title: 'Scaffold',
    body: (
      <>
        One command creates a <code className="font-mono text-fd-foreground/90">typebase/</code> folder in your existing app, with a database schema,
        example actions, and optional auth or realtime publishing. No separate repo, no dashboard.
      </>
    ),
    command: 'npx typebase-io-cli init',
  },
  {
    number: '02',
    title: 'Write TypeScript',
    body: (
      <>
        Define tables in <code className="font-mono text-fd-foreground/90">db/schema.ts</code>, export actions from{' '}
        <code className="font-mono text-fd-foreground/90">actions/</code>, drop in <code className="font-mono text-fd-foreground/90">auth.ts</code>,{' '}
        <code className="font-mono text-fd-foreground/90">env.ts</code>, and <code className="font-mono text-fd-foreground/90">publisher.ts</code> for
        realtime. Every export is typechecked end to end.
      </>
    ),
  },
  {
    number: '03',
    title: 'Deploy',
    body: (
      <>
        Ships your folder as a server on Vercel, Cloudflare Workers, or Deno Deploy, with Postgres on Neon. Or generate the server code and host it
        anywhere. Typebase owns zero servers.
      </>
    ),
    command: 'npx typebase-io-cli deploy',
  },
];

export function HowItWorks() {
  return (
    <section className="py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-fd-primary">How it works</p>
          <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-fd-foreground sm:text-4xl">
            Zero to a deployed backend in two commands
          </h2>
          <p className="mt-4 text-fd-muted-foreground">
            Everything happens inside your codebase. The CLI handles codegen, schema pushes, and deployment.
          </p>
        </div>

        <ol className="mt-16 grid gap-6 lg:grid-cols-3">
          {steps.map((step) => (
            <li key={step.number} className="relative flex flex-col rounded-xl border border-fd-border bg-fd-card p-6">
              <span aria-hidden className="pointer-events-none absolute right-5 top-4 font-mono text-5xl font-bold text-fd-primary/10">
                {step.number}
              </span>
              <h3 className="text-lg font-semibold text-fd-foreground">
                <span className="mr-2 font-mono text-sm text-fd-primary">{step.number}</span>
                {step.title}
              </h3>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-fd-muted-foreground">{step.body}</p>
              {step.command ? (
                <code className="mt-5 block overflow-x-auto whitespace-nowrap rounded-lg border border-fd-border bg-fd-muted/40 px-3.5 py-2.5 font-mono text-xs text-fd-foreground/90">
                  <span className="select-none text-fd-muted-foreground">$ </span>
                  {step.command}
                </code>
              ) : null}
            </li>
          ))}
        </ol>

        <div className="mx-auto mt-10 flex max-w-2xl flex-col items-center text-center">
          <svg aria-hidden viewBox="0 0 80 90" fill="none" className="h-16 w-auto -rotate-6 text-fd-primary/70">
            <path d="M40 4 C 16 20, 64 32, 44 50 C 30 62, 50 68, 40 80" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M31 72 L40 83 L49 73" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <h3 className="mt-3 text-xl font-bold tracking-tight text-fd-foreground sm:text-2xl">Step 02, expanded</h3>
        </div>
        <div className="mt-8">
          <FolderExplorer />
        </div>
      </div>
    </section>
  );
}
