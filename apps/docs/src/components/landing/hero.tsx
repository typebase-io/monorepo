import { ArrowRight, Play } from 'lucide-react';
import Link from 'next/link';

import { HeroCode } from '#components/landing/hero-code.tsx';
import { HeroTagline } from '#components/landing/hero-tagline.tsx';
import { InstallCommand } from '#components/landing/install-command.tsx';

export function Hero() {
  return (
    <section
      aria-labelledby="hero-heading"
      data-landing-section="hero"
      className="relative border-b border-fd-border lg:flex lg:flex-1 lg:items-center"
    >
      <div className="mx-auto grid w-full max-w-7xl gap-8 px-5 pt-8 pb-10 sm:px-8 sm:pt-16 sm:pb-14 lg:grid-cols-[1fr_1.1fr] lg:items-start lg:gap-10 lg:px-12 lg:pt-18 lg:pb-16">
        <div>
          <HeroTagline align="left" className="mb-5 text-[11px] min-[360px]:text-xs sm:text-sm" />
          <h1 id="hero-heading" className="text-[clamp(2.65rem,5.2vw,4.75rem)] font-semibold leading-[0.99] tracking-[-0.055em]">
            Your app needs
            <br />a backend.
            <br />
            <span className="text-fd-primary">Make it a folder.</span>
          </h1>
          <p className="mt-5 max-w-md text-base leading-7 text-fd-muted-foreground sm:text-lg sm:leading-8">
            Add a <span className="font-mono text-[0.92em] text-fd-foreground">typebase/</span> folder to your repo: database, server functions, and
            auth, all in TypeScript. Your frontend calls them like local functions.
          </p>
          <InstallCommand command="npx typebase-io-cli init" eventName="init" />
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link
              href="/docs/getting-started"
              className="inline-flex min-h-11 items-center gap-2 text-sm text-fd-primary underline-offset-4 hover:underline"
            >
              Quickstart guide <ArrowRight aria-hidden className="size-3.5" />
            </Link>
            <a
              href="https://youtu.be/pvL5LOt567g"
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center gap-2 text-sm text-fd-primary underline-offset-4 hover:underline"
            >
              <Play aria-hidden className="size-3.5" /> Watch in 100 seconds
            </a>
          </div>
        </div>
        <HeroCode />
      </div>
    </section>
  );
}
