import { ArrowRight, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

import { Code } from '#components/home/code.tsx';

export function FinalCTA() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <h2 className="text-4xl font-bold tracking-tight text-fd-foreground sm:text-5xl">Make your backend a folder.</h2>
        <p className="mt-4 text-fd-muted-foreground">
          It takes about ninety seconds. Most of that is <Code>npm install</Code>.
        </p>

        <div className="mx-auto mt-8 w-fit max-w-full overflow-x-auto rounded-lg border border-fd-border bg-fd-card px-4 py-3 text-left font-mono text-sm text-fd-foreground/90">
          <code className="whitespace-nowrap">
            <span className="text-fd-muted-foreground select-none">$ </span>
            npm i typebase-io <span className="text-fd-muted-foreground">&amp;&amp;</span> npm i -D typebase-io-cli
          </code>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/docs/getting-started"
            className="inline-flex items-center gap-2 rounded-lg bg-fd-primary px-5 py-3 text-sm font-semibold text-fd-primary-foreground transition hover:opacity-90"
          >
            Read the docs
            <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href="https://github.com/typebase-io/monorepo"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-fd-border bg-fd-muted/30 px-5 py-3 text-sm font-semibold text-fd-foreground transition hover:bg-fd-accent/40"
          >
            Star on GitHub
            <ArrowUpRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </section>
  );
}
