import { CodeWalkthrough } from '#components/landing/code-walkthrough.tsx';
import { SectionLabel } from '#components/landing/section-label.tsx';

export function HowItWorks() {
  return (
    <section id="how-it-works" aria-labelledby="example-heading" data-landing-section="example" className="scroll-mt-20 border-b border-fd-border">
      <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-20 lg:px-12">
        <SectionLabel number="01">Less wiring. More building.</SectionLabel>
        <div className="mt-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end sm:gap-12">
          <h2 id="example-heading" className="max-w-xl text-4xl font-semibold leading-[1.08] tracking-[-0.04em] sm:text-5xl">
            Your database.
            <br />
            <span className="text-fd-muted-foreground">Meet your frontend.</span>
          </h2>
        </div>
        <CodeWalkthrough />
      </div>
    </section>
  );
}
