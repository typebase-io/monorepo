import { describe, expect, it } from 'vitest';

import { denoIndexFileTemplate } from '#helpers/templates/index-file/deno.ts';

describe('denoIndexFileTemplate', () => {
  const ROUTER = 'const router = {};';

  it('renders the deno entrypoint without auth', () => {
    expect(denoIndexFileTemplate(ROUTER, 5000, false)).toEqualTemplate('index-file', 'deno', 'no-auth.txt');
  });

  it('renders the deno entrypoint with the auth handler when auth is enabled', () => {
    expect(denoIndexFileTemplate(ROUTER, 5000, true)).toEqualTemplate('index-file', 'deno', 'auth.txt');
  });

  describe('when using a different port', () => {
    it('renders the deno entrypoint with correct port', () => {
      expect(denoIndexFileTemplate(ROUTER, 8080, true)).toEqualTemplate('index-file', 'deno', 'with-different-port.txt');
    });
  });
});
