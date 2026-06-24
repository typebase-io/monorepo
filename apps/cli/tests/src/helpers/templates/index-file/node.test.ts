import { describe, expect, it } from 'vitest';

import { nodeIndexFileTemplate } from '#helpers/templates/index-file/node.ts';

describe('nodeIndexFileTemplate', () => {
  const ROUTER = 'const router = {};';

  it('renders the node entrypoint without auth', () => {
    expect(nodeIndexFileTemplate(ROUTER, 7000, false, [])).toEqualTemplate('index-file', 'node', 'no-auth.txt');
  });

  it('renders the simple auth handler when auth is enabled without trusted origins', () => {
    expect(nodeIndexFileTemplate(ROUTER, 7000, true, [])).toEqualTemplate('index-file', 'node', 'auth-no-origins.txt');
  });

  it('renders the trusted-origins CORS handling when auth and origins are present', () => {
    expect(nodeIndexFileTemplate(ROUTER, 7000, true, ['https://app.com', 'https://admin.com'])).toEqualTemplate(
      'index-file',
      'node',
      'auth-origins.txt'
    );
  });

  describe('when using a different port', () => {
    it('renders the node entrypoint with correct port', () => {
      expect(nodeIndexFileTemplate(ROUTER, 8080, true, ['https://app.com', 'https://admin.com'])).toEqualTemplate(
        'index-file',
        'node',
        'with-different-port.txt'
      );
    });
  });
});
