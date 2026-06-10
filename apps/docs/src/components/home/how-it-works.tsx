const steps = [
  {
    number: '01',
    title: 'Scaffold',
    body: (
      <>
        One command creates a <code className="font-mono text-fd-foreground/90">typebase/</code> folder in your existing app, with a database schema,
        example actions, and optional auth. No separate repo, no dashboard.
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
        <code className="font-mono text-fd-foreground/90">actions/</code>, drop in <code className="font-mono text-fd-foreground/90">auth.ts</code>.
        Every export is typechecked end to end.
      </>
    ),
    command: 'typebase/actions/queries/todos.ts',
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
              <code className="mt-5 block overflow-x-auto whitespace-nowrap rounded-lg border border-fd-border bg-fd-muted/40 px-3.5 py-2.5 font-mono text-xs text-fd-foreground/90">
                <span className="select-none text-fd-muted-foreground">{step.command.startsWith('npx') ? '$ ' : '// '}</span>
                {step.command}
              </code>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
