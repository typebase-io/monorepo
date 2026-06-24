import { describe, expect, it } from 'vitest';

import { bunIndexFileTemplate } from '#helpers/templates/index-file/bun.ts';

describe('bunIndexFileTemplate', () => {
  const ROUTER = 'const router = {};';

  it('renders the bun entrypoint without auth', () => {
    expect(bunIndexFileTemplate(ROUTER, 4000, false)).toEqualTemplate('index-file', 'bun', 'no-auth.txt');
  });

  it('renders the bun entrypoint with the auth handler when auth is enabled', () => {
    expect(bunIndexFileTemplate(ROUTER, 4000, true)).toEqualTemplate('index-file', 'bun', 'auth.txt');
  });

  describe('when using a different port', () => {
    it('renders the bun entrypoint with correct port', () => {
      expect(bunIndexFileTemplate(ROUTER, 8080, true)).toEqualTemplate('index-file', 'bun', 'with-different-port.txt');
    });
  });
});
