import { generate as DefaultImage } from 'fumadocs-ui/og';
import { ImageResponse } from 'next/og';

export const revalidate = false;

export function GET() {
  return new ImageResponse(
    <DefaultImage
      title="Typebase — your backend, in a folder"
      description="A type-safe backend you write as TypeScript files inside your existing repo."
      site="Typebase"
    />,
    {
      width: 1200,
      height: 630,
    }
  );
}
