import { brandedOgImage } from '#lib/og.tsx';

export const revalidate = false;

export function GET() {
  return brandedOgImage({
    title: 'Your backend,',
    titleAccent: 'in a folder.',
    description: 'A type-safe backend you write as TypeScript files inside your existing repo.',
  });
}
