import { ArrowRight, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

import { AgentPromptLine } from '#components/home/agent-prompt-line.tsx';
import { Code } from '#components/home/code.tsx';
import { CopyCommand } from '#components/home/copy-command.tsx';

export function FinalCTA() {
  return (
    <section className="border-t border-fd-border bg-fd-muted/20 py-16 sm:py-24">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <h2 className="text-4xl font-bold tracking-tight text-fd-foreground sm:text-5xl text-balance">Give your agent a backend it can read.</h2>
        <p className="mt-4 text-fd-muted-foreground text-balance">
          It takes about ninety seconds. Most of that is <Code>npm install</Code>.
        </p>

        <CopyCommand command="npm i typebase-io && npm i -D typebase-io-cli">
          <span className="select-none text-fd-muted-foreground">$ </span>
          npm i typebase-io <span className="text-fd-muted-foreground">&amp;&amp;</span> npm i -D typebase-io-cli
        </CopyCommand>

        <AgentPromptLine />

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
