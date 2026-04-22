import { Features } from '#components/home/features.tsx';
import { FinalCTA } from '#components/home/final-cta.tsx';
import { Hero } from '#components/home/hero.tsx';
import { Quotes } from '#components/home/quotes.tsx';
import { WorksWith } from '#components/home/works-with.tsx';

export default function HomePage() {
  return (
    <main className="flex flex-col">
      <Hero />
      <WorksWith />
      <Features />
      <Quotes />
      <FinalCTA />
    </main>
  );
}
