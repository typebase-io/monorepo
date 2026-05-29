import { brandedOgImage } from '#lib/og.tsx';

export const revalidate = false;

export function GET() {
  return brandedOgImage({
    title: 'Just use code',
    titleAccent: 'AI loves code',
    description: 'A type-safe backend you write as TypeScript files inside your existing repo.',
  });
}
