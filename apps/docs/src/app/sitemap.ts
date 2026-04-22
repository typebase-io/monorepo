import type { MetadataRoute } from 'next';

import { source } from '#lib/source.ts';

const SITE_URL = 'https://typebase.io';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const docs: MetadataRoute.Sitemap = source.getPages().map((page) => ({
    url: `${SITE_URL}${page.url}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

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
