import { Bot, Database, FileCode, KeyRound, Rocket, Sparkles } from 'lucide-react';

import { Code } from '#components/home/code.tsx';

const features = [
  {
    icon: FileCode,
    title: 'Actions as files.',
    body: (
      <>
        <Code>actions/queries/todos.ts</Code> becomes <Code>client.queries.todos.*</Code>. Types flow from your handler&rsquo;s <Code>.input()</Code>{' '}
        and <Code>.output()</Code> straight to your client.
      </>
    ),
  },
  {
    icon: Database,
    title: 'Your schema, typed from the column up.',
    body: (
      <>
        Tables live in <Code>db/schema.ts</Code> as Drizzle definitions. <Code>npx typebase-io-cli db push</Code> syncs them to Postgres. Column types
        flow through <Code>db.query.*</Code>, your handlers, and into your client.
      </>
    ),
  },
  {
    icon: KeyRound,
    title: 'Auth is one file.',
    body: (
      <>
        Drop in <Code>auth.ts</Code>, run <Code>npx typebase-io-cli auth generate</Code>, and better-auth handles sessions, email/password, and OAuth.
        Protected actions are a one-line middleware.
      </>
    ),
  },
  {
    icon: Rocket,
    title: 'One command, pick your cloud.',
    body: (
      <>
        <Code>npx typebase-io-cli deploy</Code> builds for Vercel, Cloudflare Workers, or Deno Deploy. Managed Postgres through Neon. No proprietary
        hosting meta-platform.
      </>
    ),
  },
  {
    icon: Sparkles,
    title: 'Framework-shaped clients.',
    body: (
      <>
        Idiomatic wiring for Server Components, SvelteKit load functions, Nuxt plugins, and Expo SecureStore. We meet each framework where it lives.
      </>
    ),
  },
  {
    icon: Bot,
    title: 'Built for AI.',
    body: (
      <>
        Conventions are file-based and types flow end-to-end. Coding agents get a tight loop: drop a file in <Code>actions/</Code>, the typecheck
        catches mistakes immediately, and there&rsquo;s no hidden DSL or registration step to learn.
      </>
    ),
  },
];

export function Features() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance text-3xl font-bold tracking-tight text-fd-foreground sm:text-4xl">
            <span className="whitespace-nowrap">Enough database.</span> <span className="whitespace-nowrap">Enough API.</span>{' '}
            <span className="whitespace-nowrap">Enough auth.</span>
          </h2>
          <p className="mt-4 text-fd-muted-foreground">
            Typebase is built on three libraries you already trust — Drizzle ORM, oRPC, and better-auth — wired together so you stop writing glue and
            start writing the app.
          </p>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, body }) => (
            <div key={title} className="group rounded-xl border border-fd-border bg-fd-card p-6 transition hover:border-fd-primary/40">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-fd-primary/15 text-fd-primary">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-lg font-semibold text-fd-foreground">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-fd-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
