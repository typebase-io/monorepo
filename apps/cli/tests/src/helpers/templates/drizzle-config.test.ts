import { describe, expect, it } from 'vitest';

import { drizzleConfigTemplate } from '#helpers/templates/drizzle-config.ts';

describe('drizzleConfigTemplate', () => {
  describe('with typescript', () => {
    it('renders the config pointing at the .ts schema for the node adapter', () => {
      expect(drizzleConfigTemplate({ ts: true, adapter: 'node' })).toEqualTemplate('drizzle-config', 'with-typescript', 'other-adapter.txt');
    });

    it('renders the config using the workers env binding for the cloudflare adapter', () => {
      expect(drizzleConfigTemplate({ ts: true, adapter: 'cloudflare' })).toEqualTemplate('drizzle-config', 'with-typescript', 'cloudflare.txt');
    });
  });

  describe('without typescript', () => {
    it('renders the config pointing at the .js schema for the node adapter', () => {
      expect(drizzleConfigTemplate({ ts: false, adapter: 'node' })).toEqualTemplate('drizzle-config', 'without-typescript', 'other-adapter.txt');
    });

    it('renders the config using the workers env binding for the cloudflare adapter', () => {
      expect(drizzleConfigTemplate({ ts: false, adapter: 'cloudflare' })).toEqualTemplate('drizzle-config', 'without-typescript', 'cloudflare.txt');
    });
  });
});
