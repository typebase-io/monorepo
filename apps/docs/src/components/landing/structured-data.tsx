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

export function StructuredData() {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />;
}
