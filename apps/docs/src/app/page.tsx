import type { Metadata } from 'next';

import { LandingAnalytics } from '#components/landing/analytics.tsx';
import { Authorization } from '#components/landing/authorization.tsx';
import { BuildWithAI } from '#components/landing/build-with-ai.tsx';
import { Comparison } from '#components/landing/comparison.tsx';
import { Explore } from '#components/landing/explore.tsx';
import { Faq } from '#components/landing/faq.tsx';
import { Features } from '#components/landing/features.tsx';
import { FinalCTA } from '#components/landing/final-cta.tsx';
import { Frameworks } from '#components/landing/frameworks.tsx';
import { Hero } from '#components/landing/hero.tsx';
import { HowItWorks } from '#components/landing/how-it-works.tsx';
import { LandingFooter, LandingHeader } from '#components/landing/navigation.tsx';
import { Quotes } from '#components/landing/quotes.tsx';
import { StructuredData } from '#components/landing/structured-data.tsx';
import { display } from '#lib/fonts.ts';

const description =
  'Typebase adds a backend to your existing app. Write your database, server functions, and authentication in TypeScript. Deploy with one command.';

export const metadata: Metadata = {
  title: 'A backend for your app. A folder of TypeScript. | Typebase',
  description,
  openGraph: {
    type: 'website',
    siteName: 'Typebase',
    locale: 'en_US',
    title: 'Typebase: make your backend a folder.',
    description,
    url: '/',
    images: [{ url: '/og/site', width: 1200, height: 630, alt: 'Typebase: your backend is a folder of TypeScript.' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Typebase: make your backend a folder.',
    description,
    images: ['/og/site'],
  },
};

export default function HomePage() {
  return (
    <div
      data-landing-page="home"
      className={`${display.className} min-h-dvh bg-fd-background bg-[radial-gradient(ellipse_75%_36rem_at_48%_0,#2586c924,transparent)] text-fd-foreground selection:bg-fd-primary selection:text-fd-primary-foreground`}
    >
      <LandingAnalytics />
      <StructuredData />
      <LandingHeader />

      <main id="main">
        <div className="lg:flex lg:min-h-[calc(100svh-4rem-1px)] lg:flex-col">
          <Hero />
          <Frameworks />
        </div>

        <HowItWorks />
        <BuildWithAI />
        <Features />
        <Authorization />
        <Comparison />
        <Explore />
        <Quotes />
        <Faq />
        <FinalCTA />
      </main>

      <LandingFooter />
    </div>
  );
}
