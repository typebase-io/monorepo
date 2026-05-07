import type { MetadataRoute } from 'next';

import { source } from '#lib/source.ts';

const SITE_URL = 'https://typebase.io';

const HIGH_PRIORITY_SLUGS = new Set(['', 'getting-started', 'comparison']);

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const docs: MetadataRoute.Sitemap = source.getPages().map((page) => {
    const slug = page.slugs.join('/');
    const lastModified = page.data.lastModified ? new Date(page.data.lastModified) : now;

    return {
      url: `${SITE_URL}${page.url}`,
      lastModified,
      changeFrequency: 'weekly' as const,
      priority: HIGH_PRIORITY_SLUGS.has(slug) ? 0.9 : 0.7,
    };
  });

  return [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1,
    },
    ...docs,
  ];
}
