import { CopyAgentPrompt } from '#components/landing/agent-prompt.tsx';
import { InstallCommand } from '#components/landing/install-command.tsx';
import { PrimaryLink } from '#components/landing/primary-link.tsx';
import { SectionLabel } from '#components/landing/section-label.tsx';

export function FinalCTA() {
  return (
    <section aria-labelledby="start-heading" data-landing-section="footer-cta" className="bg-fd-secondary/45">
      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-12 sm:px-8 sm:py-20 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-20 lg:px-12">
        <div>
          <SectionLabel number="09">Your next commit</SectionLabel>
          <h2 id="start-heading" className="mt-5 text-5xl font-semibold leading-[1.02] tracking-[-0.045em] sm:text-6xl">
            Good idea.
            <br />
            <span className="text-fd-primary">Now give it a backend.</span>
          </h2>
          <p className="mt-5 text-sm text-fd-muted-foreground">Start with one function. Build the rest as you go.</p>
        </div>
        <div>
          <div className="grid gap-3 sm:flex sm:flex-wrap sm:items-center">
            <PrimaryLink>Let’s build something</PrimaryLink>
            <CopyAgentPrompt placement="footer-cta" />
          </div>
          <InstallCommand />
        </div>
      </div>
    </section>
  );
}
