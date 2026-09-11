import { networkInterfaces } from 'node:os';

import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  allowedDevOrigins:
    process.env.NODE_ENV === 'development'
      ? Object.values(networkInterfaces()).flatMap((addresses) =>
          (addresses ?? []).filter((address) => address.family === 'IPv4' && !address.internal).map((address) => address.address)
        )
      : [],
  async rewrites() {
    return [
      {
        source: '/docs/:path*.mdx',
        destination: '/llms.mdx/docs/:path*',
      },
    ];
  },
};

export default withMDX(config);
