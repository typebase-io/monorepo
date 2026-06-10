import '#global-css';

import { Analytics } from '@vercel/analytics/next';
import { RootProvider } from 'fumadocs-ui/provider/next';
import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
});

const SITE_URL = 'https://typebase.io';
const DESCRIPTION =
  'Write actions, a database schema, and auth as TypeScript files in a typebase/ folder inside your app. Your frontend calls them like local functions, end-to-end typed, zero REST boilerplate.';
const DEFAULT_TITLE = 'Typebase: your backend is a folder of TypeScript. AI loves code.';
const OG_IMAGE = {
  url: '/og/site',
  width: 1200,
  height: 630,
  alt: 'Typebase: your backend is a folder of TypeScript. AI loves code.',
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: DEFAULT_TITLE,
    template: '%s | Typebase',
  },
  description: DESCRIPTION,
  applicationName: 'Typebase',
  manifest: '/manifest.json',
  keywords: [
    'Typebase',
    'TypeScript backend',
    'type-safe backend',
    'oRPC',
    'Drizzle ORM',
    'better-auth',
    'Next.js backend',
    'SvelteKit backend',
    'Nuxt backend',
    'Expo backend',
    'end-to-end typed',
    'server actions',
  ],
  alternates: {
    canonical: '/',
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon0.svg', type: 'image/svg+xml' },
      { url: '/icon1.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/apple-icon.png',
  },
  appleWebApp: {
    title: 'Typebase',
  },
  openGraph: {
    type: 'website',
    siteName: 'Typebase',
    title: DEFAULT_TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    locale: 'en_US',
    images: [OG_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: DEFAULT_TITLE,
    description: DESCRIPTION,
    images: [OG_IMAGE.url],
  },
};

export const viewport: Viewport = {
  themeColor: '#0a111c',
  colorScheme: 'dark',
};

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${inter.className} dark`} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <RootProvider theme={{ forcedTheme: 'dark' }}>{children}</RootProvider>
        <Analytics />
      </body>
    </html>
  );
}
