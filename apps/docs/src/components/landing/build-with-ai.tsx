import { ArrowRight, Check } from 'lucide-react';
import Link from 'next/link';

import { AgentPrompt } from '#components/landing/agent-prompt.tsx';
import { SectionLabel } from '#components/landing/section-label.tsx';

export function BuildWithAI() {
  return (
    <section id="build-with-ai" aria-labelledby="agent-heading" data-landing-section="agent" className="scroll-mt-20 border-b border-fd-border">
      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-12 sm:px-8 sm:py-20 lg:grid-cols-[1fr_1fr] lg:items-center lg:gap-20 lg:px-12">
        <div>
          <SectionLabel number="02">AI already speaks TypeScript</SectionLabel>
          <h2 id="agent-heading" className="mt-5 text-4xl font-semibold leading-[1.08] tracking-[-0.04em] sm:text-5xl">
            Your agent’s
            <br />
            <span className="text-fd-primary">kind of backend.</span>
          </h2>
          <p className="mt-5 max-w-md text-sm leading-6 text-fd-muted-foreground">
            Your schema, auth, and server functions live in the repo your agent is already working in. It can follow the code from a database table
            all the way to your frontend.
          </p>
          <ul className="mt-6 max-w-md space-y-4 text-sm leading-6">
            {[
              { title: 'Familiar tools.', body: 'TypeScript, Drizzle, better-auth, and oRPC, with their own docs for your agent to read.' },
              { title: 'Useful feedback.', body: 'The type checker catches mismatches as your agent makes changes.' },
              { title: 'A skill for the specifics.', body: 'File conventions, commands, and setup instructions, ready for your agent to read.' },
            ].map((item) => (
              <li key={item.title} className="flex gap-3">
                <Check className="mt-1 size-4 shrink-0 text-fd-primary" />
                <span className="text-fd-muted-foreground">
                  <strong className="font-medium text-fd-foreground">{item.title}</strong> {item.body}
                </span>
              </li>
            ))}
          </ul>
          <Link href="/docs/skill" className="mt-6 inline-flex items-center gap-2 text-sm text-fd-primary underline-offset-4 hover:underline">
            See what the skill teaches your agent
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
        <AgentPrompt />
      </div>
    </section>
  );
}
