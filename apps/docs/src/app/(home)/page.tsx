import { Comparison } from '#components/home/comparison.tsx';
import { Features } from '#components/home/features.tsx';
import { FinalCTA } from '#components/home/final-cta.tsx';
import { Hero } from '#components/home/hero.tsx';
import { HowItWorks } from '#components/home/how-it-works.tsx';
import { Quotes } from '#components/home/quotes.tsx';
import { RlsProblem } from '#components/home/rls-problem.tsx';
import { WorksWith } from '#components/home/works-with.tsx';

const SITE_URL = 'https://typebase.io';

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: 'Typebase',
      url: SITE_URL,
      logo: `${SITE_URL}/logo.svg`,
      sameAs: ['https://github.com/typebase-io/monorepo'],
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: SITE_URL,
      name: 'Typebase',
      description: 'A type-safe backend you write as TypeScript files inside your existing app.',
      publisher: { '@id': `${SITE_URL}/#organization` },
      inLanguage: 'en-US',
    },
    {
      '@type': 'SoftwareApplication',
      name: 'Typebase',
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'Cross-platform',
      description:
        'Write your actions, database schema, and auth as TypeScript files. Run one command. Your frontend calls them like local functions, end-to-end typed, zero REST boilerplate.',
      url: SITE_URL,
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
      },
    },
  ],
};

export default function HomePage() {
  return (
    <main className="flex flex-col">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Hero />
      <WorksWith />
      <HowItWorks />
      <RlsProblem />
      <Comparison />
      <Features />
      <Quotes />
      <FinalCTA />
    </main>
  );
}
