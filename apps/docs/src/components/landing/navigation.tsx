import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

import { Wordmark } from '#components/brand.tsx';
import { PrimaryLink } from '#components/landing/primary-link.tsx';
import { ScrollTo } from '#components/landing/scroll-to.tsx';
import { SearchTrigger } from '#components/landing/search-trigger.tsx';
import { gitConfig } from '#lib/layout.shared.tsx';

const githubUrl = `https://github.com/${gitConfig.user}/${gitConfig.repo}`;

export function LandingHeader() {
  return (
    <header
      data-landing-section="navigation"
      className="sticky top-0 z-40 border-b border-fd-border bg-fd-background/80 backdrop-blur-lg max-sm:bg-fd-background"
    >
      <nav aria-label="Main navigation" className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5 sm:px-8 lg:px-12">
        <Link href="/" aria-label="Typebase home" className="inline-flex shrink-0">
          <Wordmark />
        </Link>
        <div className="flex items-center gap-4 text-sm text-fd-muted-foreground sm:gap-6 lg:gap-8">
          <ScrollTo targetId="how-it-works" className="hidden cursor-pointer transition-colors hover:text-fd-foreground md:block">
            How it works
          </ScrollTo>
          <Link href="/docs" className="transition-colors hover:text-fd-foreground">
            Docs
          </Link>
          <a
            href={githubUrl}
            target="_blank"
            rel="noreferrer"
            className="hidden items-center gap-1.5 transition-colors hover:text-fd-foreground md:flex"
          >
            GitHub
            <ArrowUpRight className="size-3.5" />
          </a>
          <SearchTrigger className="hidden cursor-pointer transition-colors hover:text-fd-foreground sm:block" />
          <PrimaryLink className="min-h-9 px-3 py-2 text-xs sm:px-4 sm:text-sm">Get started</PrimaryLink>
        </div>
      </nav>
    </header>
  );
}

export function LandingFooter() {
  return (
    <footer data-landing-section="footer" className="border-t border-fd-border">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-5 py-8 sm:flex-row sm:items-center sm:px-8 lg:px-12">
        <div className="flex items-center gap-5">
          <Link href="/" aria-label="Typebase home" className="inline-flex shrink-0">
            <Wordmark />
          </Link>
          <span className="border-l border-fd-border pl-5 font-mono text-[10px] text-fd-muted-foreground">Just use code.</span>
        </div>
        <nav
          aria-label="Footer navigation"
          className="flex flex-wrap justify-center gap-x-6 gap-y-4 text-xs text-fd-muted-foreground sm:justify-start"
        >
          <Link href="/docs" className="hover:text-fd-primary">
            Documentation
          </Link>
          <Link href="/docs/roadmap" className="hover:text-fd-primary">
            Roadmap
          </Link>
          <Link href="/docs/changelog" className="hover:text-fd-primary">
            Changelog
          </Link>
          <a href={githubUrl} target="_blank" rel="noreferrer" className="hover:text-fd-primary">
            GitHub
          </a>
          <a href={`${githubUrl}/blob/main/LICENSE`} target="_blank" rel="noreferrer" className="hover:text-fd-primary">
            MIT licensed
          </a>
        </nav>
      </div>
    </footer>
  );
}
