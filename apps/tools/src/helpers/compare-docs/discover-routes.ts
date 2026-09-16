export const discoverRoutes = async (origin: string): Promise<string[]> => {
  const routes = new Set(['/']);
  const visited = new Set<string>();

  const unescape = (text: string) =>
    text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");

  const readSitemap = async (pathname: string): Promise<void> => {
    if (visited.has(pathname)) {
      return;
    }

    visited.add(pathname);

    const response = await fetch(new URL(pathname, origin), { signal: AbortSignal.timeout(30_000) });

    if (!response.ok) {
      throw new Error(`Cannot discover pages: ${origin}${pathname} returned ${response.status}. Use --pages /,/docs for an explicit route list.`);
    }

    const xml = await response.text();

    if (!/<(?:\w+:)?(?:urlset|sitemapindex)\b/.test(xml)) {
      throw new Error(`Expected a sitemap at ${origin}${pathname}. Use --pages for sites without one.`);
    }

    const index = /<(?:\w+:)?sitemapindex\b/.test(xml);

    for (const match of xml.matchAll(/<(?:\w+:)?loc>\s*([\s\S]*?)\s*<\/(?:\w+:)?loc>/g)) {
      const url = new URL(unescape((match[1] ?? '').replace(/^<!\[CDATA\[|\]\]>$/g, '')), origin);

      if (index) {
        await readSitemap(url.pathname + url.search);
      } else {
        routes.add(url.pathname);
      }
    }
  };

  await readSitemap('/sitemap.xml');

  return [...routes].sort();
};
