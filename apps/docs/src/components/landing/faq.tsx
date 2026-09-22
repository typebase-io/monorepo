import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

import { FaqItem } from '#components/landing/faq-item.tsx';
import { ScrollTo } from '#components/landing/scroll-to.tsx';

export function Faq() {
  return (
    <section aria-labelledby="faq-heading" data-landing-section="faq" className="border-b border-fd-border">
      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-12 sm:px-8 sm:py-20 lg:grid-cols-[1fr_2fr] lg:gap-20 lg:px-12">
        <div>
          <h2 id="faq-heading" className="text-3xl font-semibold leading-[1.1] tracking-[-0.035em] sm:text-4xl">
            Fair questions,
            <br />
            straight <span className="text-fd-primary">answers</span>.
          </h2>
          <a
            href="https://youtu.be/pvL5LOt567g"
            target="_blank"
            rel="noreferrer"
            className="mt-6 inline-flex items-center gap-2 text-sm text-fd-primary underline-offset-4 hover:underline"
          >
            Watch Typebase in 100 seconds
            <ArrowUpRight className="size-3.5" />
          </a>
        </div>
        <div className="border-t border-fd-border">
          {[
            {
              question: 'Can I add it to an app I already have?',
              answer: (
                <>
                  Yes. Install Typebase in your existing JavaScript or TypeScript project. Your frontend stays where it is; the backend goes in a
                  typebase/ folder. Start with the{' '}
                  <Link href="/docs/getting-started" className="text-fd-primary underline underline-offset-4">
                    getting started guide
                  </Link>
                  .
                </>
              ),
            },
            {
              question: 'Is Typebase a hosting service?',
              answer: (
                <>
                  Typebase is a library and CLI. Your server runs in your own hosting account, and the database is yours too. The CLI deploys to
                  Vercel, Cloudflare Workers, or Deno Deploy with a Neon database. You can also{' '}
                  <Link href="/docs/cli/generate-server" className="text-fd-primary underline underline-offset-4">
                    generate a server to host yourself
                  </Link>
                  .
                </>
              ),
            },
            {
              question: 'What does it cost?',
              answer: (
                <>
                  Typebase is free and open source under the MIT license. You pay your hosting and database providers for their usage. Typebase
                  doesn’t add a platform fee.
                </>
              ),
            },
            {
              question: 'How is this different from Supabase or Convex?',
              answer: (
                <>
                  Typebase keeps everything in one place. Your tables, your server functions, and your auth are files in the repo you already have,
                  not settings spread across a dashboard and a handful of separate services. There is no new paradigm to learn either: where Convex
                  asks you to take on its document model, its query API, and its reactive defaults, Typebase is TypeScript over ordinary Postgres,
                  with Drizzle and better-auth doing the work you already know them for. The{' '}
                  <ScrollTo targetId="comparison" className="cursor-pointer text-fd-primary underline underline-offset-4">
                    comparison above
                  </ScrollTo>{' '}
                  goes row by row.
                </>
              ),
            },
            {
              question: 'Can I run it locally?',
              answer: (
                <>
                  Yes. The start command builds your server and restarts it as you edit. If you use a database, connect your own local Postgres or a
                  dev database. Follow the{' '}
                  <Link href="/docs/work-locally" className="text-fd-primary underline underline-offset-4">
                    local development guide
                  </Link>
                  .
                </>
              ),
            },
          ].map((faq) => (
            <FaqItem key={faq.question} question={faq.question}>
              {faq.answer}
            </FaqItem>
          ))}
        </div>
      </div>
    </section>
  );
}
