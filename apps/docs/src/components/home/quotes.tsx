const quotes = [
  {
    quote: 'I deleted 40,000 lines of REST plumbing last quarter. My tech lead cried. I think they were happy tears. I have stopped asking.',
    name: 'Mariel Vonnegut',
    role: 'Principal Eng, AI unicorn you\u2019ve heard of',
  },
  {
    quote:
      'Before Typebase I had three acronyms in my pipeline: REST, gRPC, and WHY. Now I have one: fn(). I have never been happier and my Oura ring agrees.',
    name: 'Dave Dave',
    role: 'Senior Fullstack, maybe',
  },
  {
    quote:
      'I\u2019ve told four separate therapists about Typebase. Two stopped taking me as a client. The other two are now shipping an app with it.',
    name: 'Clementine Ryu',
    role: 'Engineer, between therapists',
  },
  {
    quote:
      'My co-founder asked where the auth lives. I said \u201Ca file called auth.ts.\u201D He hasn\u2019t spoken to me since. I assume he\u2019s impressed.',
    name: 'Tom\u00E1s Lindberg',
    role: 'Indie hacker, possibly single',
  },
  {
    quote: 'We replaced 14 microservices with one folder. The DevOps team threw me a party. The party was a meeting. The meeting was about layoffs.',
    name: 'Anonymous',
    role: 'For obvious reasons',
  },
  {
    quote: '10/10 would make my backend a folder again.',
    name: 'Hannah Pollard',
    role: 'Senior Folder Engineer, self-appointed',
  },
];

export function Quotes() {
  return (
    <section className="border-t border-fd-border bg-fd-muted/20 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-fd-foreground sm:text-4xl">Industry-shaking testimonials*</h2>
          <p className="mt-3 text-sm text-fd-muted-foreground">
            <span className="italic">*</span> None of these people exist. We checked. Twice. Legal is chill.
          </p>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {quotes.map((q) => (
            <figure key={q.name} className="flex flex-col rounded-xl border border-dashed border-fd-border bg-fd-card p-6">
              <div className="flex items-center gap-1 text-fd-primary/70">
                {Array.from({ length: 5 }).map((_, i) => (
                  <svg key={i} viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                    <path d="M12 2l2.9 6.9 7.1.6-5.4 4.7 1.6 7.1L12 17.8 5.8 21.3l1.6-7.1L2 9.5l7.1-.6L12 2z" />
                  </svg>
                ))}
              </div>
              <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-fd-foreground">&ldquo;{q.quote}&rdquo;</blockquote>
              <figcaption className="mt-6 flex items-center gap-3 border-t border-fd-border pt-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-fd-primary/15 text-xs font-bold text-fd-primary">
                  {q.name
                    .split(' ')
                    .map((p) => p[0])
                    .slice(0, 2)
                    .join('')}
                </div>
                <div className="min-w-0 text-xs">
                  <div className="truncate font-semibold text-fd-foreground/90">{q.name}</div>
                  <div className="truncate text-fd-muted-foreground">{q.role}</div>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>

        <p className="mx-auto mt-14 max-w-xl text-center text-xs text-fd-muted-foreground">
          Do you have a real, non-fabricated quote? We will happily replace one of these humans with you.
        </p>
      </div>
    </section>
  );
}
