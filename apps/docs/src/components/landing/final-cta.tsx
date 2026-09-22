import { CopyAgentPrompt } from '#components/landing/agent-prompt.tsx';
import { InstallCommand } from '#components/landing/install-command.tsx';
import { PrimaryLink } from '#components/landing/primary-link.tsx';

export function FinalCTA() {
  return (
    <section aria-labelledby="start-heading" data-landing-section="footer-cta" className="bg-fd-secondary/45">
      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-12 sm:px-8 sm:py-20 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-20 lg:px-12">
        <div>
          <h2 id="start-heading" className="text-4xl font-semibold leading-[1.04] tracking-[-0.045em] sm:text-5xl">
            Good idea.
            <br />
            <span className="text-fd-primary">Now give it a backend.</span>
          </h2>
          <p className="mt-5 text-sm text-fd-muted-foreground">Start with one function. Build the rest as you go.</p>
        </div>
        <div>
          <div className="grid gap-3 sm:flex sm:flex-wrap sm:items-center">
            <PrimaryLink>Get started</PrimaryLink>
            <CopyAgentPrompt placement="footer-cta" />
          </div>
          <InstallCommand />
        </div>
      </div>
    </section>
  );
}
