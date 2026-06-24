import { describe, expect, it } from 'vitest';

import { cloudflareIndexFileTemplate } from '#helpers/templates/index-file/cloudflare.ts';

describe('cloudflareIndexFileTemplate', () => {
  const ROUTER = 'const router = {};';

  it('renders the cloudflare worker entrypoint without auth', () => {
    expect(cloudflareIndexFileTemplate(ROUTER, false)).toEqualTemplate('index-file', 'cloudflare', 'no-auth.txt');
  });

  it('renders the cloudflare worker entrypoint with the auth handler when auth is enabled', () => {
    expect(cloudflareIndexFileTemplate(ROUTER, true)).toEqualTemplate('index-file', 'cloudflare', 'auth.txt');
  });
});
