import { describe, expect, it } from 'vitest';

import { fastifyIndexFileTemplate } from '#helpers/templates/index-file/fastify.ts';

describe('fastifyIndexFileTemplate', () => {
  const ROUTER = 'const router = {};';

  it('renders the fastify entrypoint without auth', () => {
    expect(fastifyIndexFileTemplate(ROUTER, 6000, false, [])).toEqualTemplate('index-file', 'fastify', 'no-auth.txt');
  });

  it('renders the auth route but no cors when auth is enabled without trusted origins', () => {
    expect(fastifyIndexFileTemplate(ROUTER, 6000, true, [])).toEqualTemplate('index-file', 'fastify', 'auth-no-origins.txt');
  });

  it('renders cors with the trusted origins when auth and origins are present', () => {
    expect(fastifyIndexFileTemplate(ROUTER, 6000, true, ['https://app.com', 'https://admin.com'])).toEqualTemplate(
      'index-file',
      'fastify',
      'auth-origins.txt'
    );
  });

  describe('when using a different port', () => {
    it('renders the fastify entrypoint with correct port', () => {
      expect(fastifyIndexFileTemplate(ROUTER, 8080, true, ['https://app.com', 'https://admin.com'])).toEqualTemplate(
        'index-file',
        'fastify',
        'with-different-port.txt'
      );
    });
  });
});
