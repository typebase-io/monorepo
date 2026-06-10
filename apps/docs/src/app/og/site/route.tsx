import { brandedOgImage } from '#lib/og.tsx';

export const revalidate = false;

export function GET() {
  return brandedOgImage({
    title: 'Your backend is',
    titleAccent: 'a folder of TypeScript',
    description: 'A type-safe backend you write as TypeScript files inside your existing app. AI loves code.',
  });
}
