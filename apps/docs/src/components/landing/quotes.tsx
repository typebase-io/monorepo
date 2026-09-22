const quotes = [
  {
    text: 'I deleted 40,000 lines of REST plumbing last quarter. My tech lead cried. I think they were happy tears. I have stopped asking.',
    name: 'Mariel Vonnegut',
    role: 'Principal Eng, AI unicorn you’ve heard of',
  },
  {
    text: 'Before Typebase I had three acronyms in my pipeline: REST, gRPC, and WHY. Now I have one: fn(). I have never been happier and my Oura ring agrees.',
    name: 'Dave Dave',
    role: 'Senior Fullstack, maybe',
  },
  {
    text: 'I’ve told four separate therapists about Typebase. Two stopped taking me as a client. The other two are now shipping an app with it.',
    name: 'Clementine Ryu',
    role: 'Engineer, between therapists',
  },
  {
    text: 'My co-founder asked where the auth lives. I said “a file called auth.ts.” He hasn’t spoken to me since. I assume he’s impressed.',
    name: 'Tomás Lindberg',
    role: 'Indie hacker, possibly single',
  },
  {
    text: 'We replaced 14 microservices with one folder. The DevOps team threw me a party. The party was a meeting. The meeting was about layoffs.',
    name: 'Anonymous',
    role: 'For obvious reasons',
  },
  {
    text: '10/10 would make my backend a folder again.',
    name: 'Hannah Pollard',
    role: 'Senior Folder Engineer, self-appointed',
  },
];

const cell =
  'flex flex-col border-fd-primary/25 py-7 max-md:-mx-5 max-md:px-5 max-md:odd:bg-fd-primary/8 md:border-b md:border-r md:px-7 md:[&:nth-child(3n)]:border-r-0 md:[&:nth-child(3n)]:pr-0 md:[&:nth-child(3n+1)]:pl-0 lg:px-10';

export function Quotes() {
  return (
    <section aria-labelledby="quotes-heading" className="border-b border-fd-border bg-fd-muted/25">
      <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-20 lg:px-12">
        <h2 id="quotes-heading" className="text-4xl font-semibold leading-[1.08] tracking-[-0.04em] sm:text-5xl">
          Real backend.
          <br />
          Imaginary fan club.
        </h2>
        <p className="mt-5 max-w-md text-sm leading-6 text-fd-muted-foreground">
          None of these people exist. Their taste in backend tooling is excellent tho.
        </p>
        <div className="mt-10 grid border-fd-primary/25 md:grid-cols-3 md:border-t">
          {quotes.map((quote, index) => (
            <figure key={quote.name} className={cell}>
              <span aria-hidden="true" className="font-serif text-5xl leading-none text-fd-primary">
                “
              </span>
              <blockquote className={`mt-2 flex-1 leading-relaxed ${index === 5 ? 'max-w-64 text-3xl tracking-tight' : 'text-base'}`}>
                {quote.text}
              </blockquote>
              <figcaption className="mt-7 text-xs">
                <span className="font-semibold">{quote.name}</span>
                <span className="mt-1 block text-fd-muted-foreground">{quote.role}</span>
              </figcaption>
            </figure>
          ))}
        </div>
        <p className="mt-4 font-mono text-[10px] text-fd-muted-foreground">* The people are made up. The code above isn’t.</p>
      </div>
    </section>
  );
}
