import { brandedOgImage } from '#lib/og.tsx';

export const revalidate = false;

export function GET() {
  return brandedOgImage({
    title: 'Like Supabase, but code',
    titleAccent: 'your AI can read.',
    description: 'A type-safe backend you write as TypeScript files inside your existing app. AI loves code.',
  });
}
