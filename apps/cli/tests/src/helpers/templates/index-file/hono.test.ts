import { describe, expect, it } from 'vitest';

import { honoIndexFileTemplate } from '#helpers/templates/index-file/hono.ts';

describe('honoIndexFileTemplate', () => {
  const ROUTER = 'const router = {};';

  it('renders the hono entrypoint without auth', () => {
    expect(honoIndexFileTemplate(ROUTER, false, [])).toEqualTemplate('index-file', 'hono', 'no-auth.txt');
  });

  it('renders the auth route but no cors when auth is enabled without trusted origins', () => {
    expect(honoIndexFileTemplate(ROUTER, true, [])).toEqualTemplate('index-file', 'hono', 'auth-no-origins.txt');
  });

  it('renders cors with the trusted origins when auth and origins are present', () => {
    expect(honoIndexFileTemplate(ROUTER, true, ['https://app.com', 'https://admin.com'])).toEqualTemplate('index-file', 'hono', 'auth-origins.txt');
  });
});
