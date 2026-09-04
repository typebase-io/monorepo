import { describe, expect, it } from 'vitest';

import { DEFAULT_ACTIONS_PATH, DEFAULT_AUTH_PATH } from '#helpers/constants.ts';
import { fastifyServerFileTemplate } from '#helpers/templates/server-file/fastify.ts';
import { type ServerFileOptions } from '#helpers/templates/server-file/options.ts';

describe('fastifyServerFileTemplate', () => {
  const OPTIONS = {
    routerCode: 'export const router = {};',
    hasAuth: false,
    trustedOrigins: [],
    mode: 'standalone',
    actionsPath: DEFAULT_ACTIONS_PATH,
    authPath: DEFAULT_AUTH_PATH,
  } satisfies ServerFileOptions;

  it('exports a plugin that registers the actions route without auth', () => {
    expect(fastifyServerFileTemplate({ ...OPTIONS, hasAuth: false, mode: 'standalone' })).toEqualTemplate('server-file', 'fastify', 'no-auth.txt');
  });

  it('registers the auth route and exports auth when auth is enabled', () => {
    expect(fastifyServerFileTemplate({ ...OPTIONS, hasAuth: true, mode: 'standalone' })).toEqualTemplate('server-file', 'fastify', 'auth.txt');
  });

  it('sets no cross-origin headers in embedded mode, where the host owns that policy', () => {
    expect(fastifyServerFileTemplate({ ...OPTIONS, hasAuth: true, mode: 'embedded' })).toEqualTemplate('server-file', 'fastify', 'embedded-auth.txt');
  });

  it('registers the catch-all content type parser inside the plugin in embedded mode, leaving the host body parsing alone', () => {
    expect(fastifyServerFileTemplate({ ...OPTIONS, hasAuth: false, mode: 'embedded' })).toEqualTemplate(
      'server-file',
      'fastify',
      'embedded-no-auth.txt'
    );
  });

  it('serves the paths it was configured with, so mounting under a prefix still reaches it', () => {
    expect(
      fastifyServerFileTemplate({ ...OPTIONS, hasAuth: true, mode: 'embedded', actionsPath: '/typebase/rpc', authPath: '/typebase/auth' })
    ).toEqualTemplate('server-file', 'fastify', 'embedded-custom-paths.txt');
  });

  it('normalizes trailing slashes in both configured paths', () => {
    expect(
      fastifyServerFileTemplate({ ...OPTIONS, hasAuth: true, mode: 'embedded', actionsPath: '/typebase/rpc///', authPath: '/typebase/auth/' })
    ).toEqualTemplate('server-file', 'fastify', 'embedded-custom-paths.txt');
  });

  it('registers root paths without a doubled slash', () => {
    expect(fastifyServerFileTemplate({ ...OPTIONS, hasAuth: true, mode: 'embedded', actionsPath: '/', authPath: '/' })).toEqualTemplate(
      'server-file',
      'fastify',
      'embedded-root-paths.txt'
    );
  });

  it('normalizes a runtime auth base path before registering its wildcard', () => {
    expect(fastifyServerFileTemplate({ ...OPTIONS, hasAuth: true, mode: 'embedded', authPath: { fromAuth: true } })).toEqualTemplate(
      'server-file',
      'fastify',
      'embedded-dynamic-auth.txt'
    );
  });
});
