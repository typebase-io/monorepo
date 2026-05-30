import { ArrowRight, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

import { C } from '#components/home/code-card/c.tsx';
import { F } from '#components/home/code-card/f.tsx';
import { CodeCard } from '#components/home/code-card/index.tsx';
import { K } from '#components/home/code-card/k.tsx';
import { Line } from '#components/home/code-card/line.tsx';
import { S } from '#components/home/code-card/s.tsx';
import { T } from '#components/home/code-card/t.tsx';
import { V } from '#components/home/code-card/v.tsx';

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-150 bg-[radial-gradient(ellipse_at_top,rgba(37,134,201,0.18),transparent_60%)]"
      />

      <div className="mx-auto max-w-6xl px-6 pt-12 pb-16 sm:pb-28">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="mt-6 text-5xl font-bold tracking-tight text-fd-foreground sm:text-7xl">
            Just use code
            <span className="mt-2 block text-5xl text-fd-primary sm:mt-3 sm:text-7xl">AI loves code</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg text-fd-muted-foreground sm:text-xl">
            Write your actions, database schema, and auth as TypeScript files in a <code>typebase/</code> folder. Your frontend calls them like local
            functions — end-to-end typed, zero REST boilerplate.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/docs/getting-started"
              className="inline-flex items-center gap-2 rounded-lg bg-fd-primary px-5 py-3 text-sm font-semibold text-fd-primary-foreground transition hover:opacity-90"
            >
              Get started
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="https://github.com/typebase-io/monorepo"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-fd-border bg-fd-muted/30 px-5 py-3 text-sm font-semibold text-fd-foreground transition hover:bg-fd-accent/40"
            >
              View on GitHub
              <ArrowUpRight className="h-4 w-4" />
            </a>
          </div>
        </div>

        <div className="mt-20 grid gap-6 lg:grid-cols-[1fr_auto_1fr] items-stretch">
          <CodeCard title="typebase/actions/queries/todos.ts" label="server">
            <Line>
              <K>import</K> {`{ `}
              <V>action</V>
              {` } `}
              <K>from</K> <S>{"'../../_generated/server'"}</S>;
            </Line>
            <Line>
              <K>import</K> {`{ `}
              <V>z</V>
              {` } `}
              <K>from</K> <S>{"'zod'"}</S>;
            </Line>
            <Line />
            <Line>
              <K>export const</K> <F>getMany</F> = <V>action</V>
            </Line>
            <Line indent={1}>
              .<F>output</F>(<V>z</V>.<F>array</F>(<V>z</V>.<F>object</F>({`{`}
            </Line>
            <Line indent={2}>
              <V>id</V>: <V>z</V>.<F>number</F>(),
            </Line>
            <Line indent={2}>
              <V>value</V>: <V>z</V>.<F>string</F>(),
            </Line>
            <Line indent={1}>{`}))) `}</Line>
            <Line indent={1}>
              .<F>handler</F>(<K>async</K> ({`{ db }`}) {`=>`} {`{`}
            </Line>
            <Line indent={2}>
              <K>return</K> <V>db</V>.<V>query</V>.<V>todos</V>.<F>findMany</F>();
            </Line>
            <Line indent={1}>{`});`}</Line>
          </CodeCard>

          <div className="flex flex-col items-center justify-center py-2 lg:py-0">
            <ArrowRight className="h-8 w-8 text-fd-primary rotate-90 lg:rotate-0" />
          </div>

          <CodeCard title="src/app/page.tsx" label="client">
            <Line>
              <K>import</K> {`{ `}
              <V>client</V>
              {` } `}
              <K>from</K> <S>{"'@/lib/typebase/client'"}</S>;
            </Line>
            <Line />
            <Line>
              <K>export default async function</K> <F>Page</F>() {`{`}
            </Line>
            <Line indent={1}>
              <K>const</K> todos = <K>await</K> <V>client</V>.<V>queries</V>.<V>todos</V>.<F>getMany</F>();
            </Line>
            <Line indent={1}>
              <C>{`// ^? { id: number; value: string }[]`}</C>
            </Line>
            <Line />
            <Line indent={1}>
              <K>return</K> todos.<F>map</F>((t) {`=>`} (
            </Line>
            <Line indent={2}>
              {`<`}
              <T>li</T> key={`{t.id}`}
              {`>`}
              {`{t.value}`}
              {`</`}
              <T>li</T>
              {`>`}
            </Line>
            <Line indent={1}>));</Line>
            <Line>{`}`}</Line>
          </CodeCard>
        </div>
      </div>
    </section>
  );
}
