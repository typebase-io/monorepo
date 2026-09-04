import { describe, expect, it } from 'vitest';

import { fastifyIndexFileTemplate } from '#helpers/templates/index-file/fastify.ts';

describe('fastifyIndexFileTemplate', () => {
  it('registers the construction unit on its own instance and listens', () => {
    expect(fastifyIndexFileTemplate(6000, false, [])).toEqualTemplate('index-file', 'fastify', 'no-auth.txt');
  });

  it('registers no cors when auth is enabled without trusted origins', () => {
    expect(fastifyIndexFileTemplate(6000, true, [])).toEqualTemplate('index-file', 'fastify', 'auth-no-origins.txt');
  });

  it('registers cors on the root instance when auth and origins are present, so it also covers unmatched requests', () => {
    expect(fastifyIndexFileTemplate(6000, true, ['https://app.com', 'https://admin.com'])).toEqualTemplate(
      'index-file',
      'fastify',
      'auth-origins.txt'
    );
  });

  describe('when using a different port', () => {
    it('listens on that port', () => {
      expect(fastifyIndexFileTemplate(8080, true, ['https://app.com', 'https://admin.com'])).toEqualTemplate(
        'index-file',
        'fastify',
        'with-different-port.txt'
      );
    });
  });
});
