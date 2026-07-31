import { describe, expect, it } from 'vitest';

import { type ServerAdapter } from '#helpers/constants.ts';
import { drizzleIndexTemplate } from '#helpers/templates/drizzle-index.ts';

const NON_CLOUDFLARE_ADAPTERS: ServerAdapter[] = ['node', 'bun', 'deno', 'fastify', 'hono'];

describe('drizzleIndexTemplate', () => {
  describe('with typescript', () => {
    it.each(NON_CLOUDFLARE_ADAPTERS)('renders the node-postgres db client and .ts imports for the %s adapter', (adapter) => {
      expect(drizzleIndexTemplate({ ts: true, adapter })).toEqualTemplate('drizzle-index', 'with-typescript', 'other-adapter.txt');
    });

    it('renders the neon-http db client and .ts imports for the cloudflare adapter', () => {
      expect(drizzleIndexTemplate({ ts: true, adapter: 'cloudflare' })).toEqualTemplate('drizzle-index', 'with-typescript', 'cloudflare.txt');
    });
  });

  describe('without typescript', () => {
    it.each(NON_CLOUDFLARE_ADAPTERS)('renders the node-postgres db client and .js imports for the %s adapter', (adapter) => {
      expect(drizzleIndexTemplate({ ts: false, adapter })).toEqualTemplate('drizzle-index', 'without-typescript', 'other-adapter.txt');
    });

    it('renders the neon-http db client and .js imports for the cloudflare adapter', () => {
      expect(drizzleIndexTemplate({ ts: false, adapter: 'cloudflare' })).toEqualTemplate('drizzle-index', 'without-typescript', 'cloudflare.txt');
    });
  });
});
