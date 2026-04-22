import './globals.css';

import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Suspense } from 'react';
import Navbar from '../components/navbar';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Todo App',
  description: 'A simple todo app built with Next.js and Typebase',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <header className="flex items-center justify-end px-6 py-4 bg-zinc-50 dark:bg-black">
          <Suspense fallback={<div className="h-7.5 w-full" />}>
            <Navbar />
          </Suspense>
        </header>

        {children}
      </body>
    </html>
  );
}
