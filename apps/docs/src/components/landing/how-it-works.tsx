import { CodeWalkthrough } from '#components/landing/code-walkthrough.tsx';
import { steps } from '#components/landing/walkthrough-steps.ts';
import { highlightCode } from '#lib/highlight-code.ts';

export async function HowItWorks() {
  const highlighted = await Promise.all(steps.map((step) => highlightCode(step.code, step.file.endsWith('.tsx') ? 'tsx' : 'ts')));

  return (
    <section id="how-it-works" aria-labelledby="example-heading" data-landing-section="example" className="scroll-mt-20 border-b border-fd-border">
      <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-20 lg:px-12">
        <h2 id="example-heading" className="font-mono text-5xl font-semibold leading-none tracking-[-0.07em] sm:text-6xl">
          tl<span className="text-fd-primary">;</span>dr<span className="sr-only">: three files, database to UI</span>
        </h2>
        <CodeWalkthrough highlighted={highlighted} />
      </div>
    </section>
  );
}
