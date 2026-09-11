import { ArrowRight, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

import { FolderIllustration } from '#components/landing/folder-illustration.tsx';
import { FolderTree } from '#components/landing/folder-tree.tsx';
import { SectionLabel } from '#components/landing/section-label.tsx';
import { gitConfig } from '#lib/layout.shared.tsx';

const githubUrl = `https://github.com/${gitConfig.user}/${gitConfig.repo}`;
const path = 'font-mono text-[0.92em] text-fd-foreground';

export function Explore() {
  return (
    <section id="explore" aria-labelledby="explore-heading" data-landing-section="explore" className="scroll-mt-20 border-b border-fd-border">
      <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-20 lg:px-12">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-center lg:gap-16">
          <div className="order-2 hidden lg:order-1 lg:block">
            <FolderIllustration />
          </div>
          <div className="order-1 lg:order-2">
            <SectionLabel number="06">Open the folder</SectionLabel>
            <h2 id="explore-heading" className="mt-5 text-4xl font-semibold leading-[1.08] tracking-[-0.04em] sm:text-5xl">
              Explore Typebase.
              <br />
              <span className="text-fd-primary">This is the whole backend.</span>
            </h2>
            <p className="mt-5 max-w-md text-sm leading-6 text-fd-muted-foreground">
              Each file has one job. <span className={path}>db/</span> defines your tables, anything you export from{' '}
              <span className={path}>actions/</span> becomes an endpoint your frontend can call, and <span className={path}>auth.ts</span> gives those
              functions a session to check. One command regenerates the types and deploys the folder as a server.
            </p>
            <div className="mt-6 grid max-w-md gap-x-6 text-sm text-fd-primary sm:grid-cols-2">
              <a
                href={`${githubUrl}/tree/main/apps/examples`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center gap-2 underline-offset-4 hover:underline"
              >
                Clone a full example app <ArrowUpRight aria-hidden className="size-3.5" />
              </a>
              <a
                href={githubUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center gap-2 underline-offset-4 hover:underline"
              >
                GitHub repository <ArrowUpRight aria-hidden className="size-3.5" />
              </a>
              <Link href="/docs/changelog" className="inline-flex min-h-11 items-center gap-2 underline-offset-4 hover:underline">
                What shipped recently <ArrowRight aria-hidden className="size-3.5" />
              </Link>
              <Link href="/docs/roadmap" className="inline-flex min-h-11 items-center gap-2 underline-offset-4 hover:underline">
                What’s next <ArrowRight aria-hidden className="size-3.5" />
              </Link>
            </div>
          </div>
        </div>
        <FolderTree />
      </div>
    </section>
  );
}
