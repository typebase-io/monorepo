import { describe, expect, it } from 'vitest';

import { drizzleIndexTemplate } from '#helpers/templates/drizzle-index.ts';

describe('drizzleIndexTemplate', () => {
  describe('with typescript', () => {
    it('renders the node-postgres db client for a non-cloudflare adapter', () => {
      expect(drizzleIndexTemplate({ ts: true, adapter: 'node' })).toEqualTemplate('drizzle-index', 'with-typescript/other-adapter.txt');
    });

    it('renders the neon-http db client for the cloudflare adapter', () => {
      expect(drizzleIndexTemplate({ ts: true, adapter: 'cloudflare' })).toEqualTemplate('drizzle-index', 'with-typescript/cloudflare.txt');
    });
  });

  describe('without typescript', () => {
    it('renders the node-postgres db client for a non-cloudflare adapter', () => {
      expect(drizzleIndexTemplate({ ts: false, adapter: 'node' })).toEqualTemplate('drizzle-index', 'without-typescript/other-adapter.txt');
    });

    it('renders the neon-http db client for the cloudflare adapter', () => {
      expect(drizzleIndexTemplate({ ts: false, adapter: 'cloudflare' })).toEqualTemplate('drizzle-index', 'without-typescript/cloudflare.txt');
    });
  });
});
