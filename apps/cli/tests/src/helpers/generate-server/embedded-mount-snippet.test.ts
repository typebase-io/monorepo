import { describe, expect, it } from 'vitest';

import { embeddedMountSnippet } from '#helpers/generate-server/embedded-mount-snippet.ts';

describe('embeddedMountSnippet', () => {
  it.each(['node', 'fastify', 'hono', 'bun', 'deno', 'cloudflare'] as const)('shows how to mount the %s adapter', (adapter) => {
    expect(`${embeddedMountSnippet({ adapter, output: 'ts', importPath: './typebase/_handler/src/server.js' })}\n`).toEqualTemplate(
      'embedded-mount-snippet',
      `${adapter}.txt`
    );
  });

  it('uses require for CommonJS output and preserves a custom import path', () => {
    expect(`${embeddedMountSnippet({ adapter: 'node', output: 'cjs', importPath: '../backend/src/server.js' })}\n`).toEqualTemplate(
      'embedded-mount-snippet',
      'node-cjs.txt'
    );
  });

  it('uses imports for ESM output', () => {
    expect(`${embeddedMountSnippet({ adapter: 'node', output: 'esm', importPath: './typebase/_handler/src/server.js' })}\n`).toEqualTemplate(
      'embedded-mount-snippet',
      'node.txt'
    );
  });

  it('uses CommonJS exports for a CommonJS Worker entry point', () => {
    expect(`${embeddedMountSnippet({ adapter: 'cloudflare', output: 'cjs', importPath: './typebase/_handler/src/server.js' })}\n`).toEqualTemplate(
      'embedded-mount-snippet',
      'cloudflare-cjs.txt'
    );
  });
});
