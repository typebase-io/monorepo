import { DocsBody, DocsDescription, DocsPage, DocsTitle, PageLastUpdate } from 'fumadocs-ui/layouts/docs/page';
import { createRelativeLink } from 'fumadocs-ui/mdx';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { LLMCopyButton, ViewOptions } from '#components/ai/page-actions.tsx';
import { gitConfig } from '#lib/layout.shared.tsx';
import { getPageImage, source } from '#lib/source.ts';
import { getMDXComponents } from '#mdx-components';

const SITE_URL = 'https://typebase.io';

export default async function Page(props: PageProps<'/docs/[[...slug]]'>) {
  const params = await props.params;
  const page = source.getPage(params.slug);

  if (!page) notFound();

  const MDX = page.data.body;
  const pageUrl = `${SITE_URL}${page.url}`;
  const imageUrl = `${SITE_URL}${getPageImage(page).url}`;

  const breadcrumbItems = [{ name: 'Docs', url: `${SITE_URL}/docs` }];
  let cumulative = '';

  page.slugs.forEach((slug, index) => {
    cumulative += `/${slug}`;

    const isLast = index === page.slugs.length - 1;

    breadcrumbItems.push({
      name: isLast ? page.data.title : slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      url: `${SITE_URL}/docs${cumulative}`,
    });
  });

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'TechArticle',
        headline: page.data.title,
        description: page.data.description,
        url: pageUrl,
        image: imageUrl,
        ...(page.data.lastModified ? { dateModified: new Date(page.data.lastModified).toISOString() } : {}),
        publisher: {
          '@type': 'Organization',
          name: 'Typebase',
          url: SITE_URL,
          logo: `${SITE_URL}/logo.svg`,
        },
        inLanguage: 'en-US',
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumbItems.map((item, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: item.name,
          item: item.url,
        })),
      },
    ],
  };

  return (
    <DocsPage toc={page.data.toc} full={page.data.full} footer={{ enabled: false }} tableOfContent={{ style: 'clerk' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription className="mb-0">{page.data.description}</DocsDescription>
      {page.data.lastModified ? <PageLastUpdate date={page.data.lastModified} /> : null}
      <div className="flex flex-row gap-2 items-center border-b pb-6">
        <LLMCopyButton markdownUrl={`${page.url}.mdx`} />
        <ViewOptions
          markdownUrl={`${page.url}.mdx`}
          // update it to match your repo
          githubUrl={`https://github.com/${gitConfig.user}/${gitConfig.repo}/blob/${gitConfig.branch}/content/docs/${page.path}`}
        />
      </div>
      <DocsBody>
        <MDX
          components={getMDXComponents({
            // this allows you to link to other pages with relative file paths
            a: createRelativeLink(source, page),
          })}
        />
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: PageProps<'/docs/[[...slug]]'>): Promise<Metadata> {
  const params = await props.params;
  const page = source.getPage(params.slug);

  if (!page) notFound();

  const imageUrl = getPageImage(page).url;

  return {
    title: page.data.title,
    description: page.data.description,
    alternates: {
      canonical: page.url,
    },
    openGraph: {
      type: 'article',
      title: page.data.title,
      description: page.data.description,
      url: page.url,
      images: [imageUrl],
    },
    twitter: {
      card: 'summary_large_image',
      title: page.data.title,
      description: page.data.description,
      images: [imageUrl],
    },
  };
}
