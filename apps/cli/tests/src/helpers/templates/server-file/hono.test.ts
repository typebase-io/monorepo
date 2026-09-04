import { describe, expect, it } from 'vitest';

import { DEFAULT_ACTIONS_PATH, DEFAULT_AUTH_PATH } from '#helpers/constants.ts';
import { honoServerFileTemplate } from '#helpers/templates/server-file/hono.ts';
import { type ServerFileOptions } from '#helpers/templates/server-file/options.ts';

describe('honoServerFileTemplate', () => {
  const OPTIONS = {
    routerCode: 'export const router = {};',
    hasAuth: false,
    trustedOrigins: [],
    mode: 'standalone',
    actionsPath: DEFAULT_ACTIONS_PATH,
    authPath: DEFAULT_AUTH_PATH,
  } satisfies ServerFileOptions;

  it('exports the application as the mount without auth', () => {
    expect(honoServerFileTemplate({ ...OPTIONS, hasAuth: false, trustedOrigins: [], mode: 'standalone' })).toEqualTemplate(
      'server-file',
      'hono',
      'no-auth.txt'
    );
  });

  it('registers the auth route but no cors when auth is enabled without trusted origins', () => {
    expect(honoServerFileTemplate({ ...OPTIONS, hasAuth: true, trustedOrigins: [], mode: 'standalone' })).toEqualTemplate(
      'server-file',
      'hono',
      'auth-no-origins.txt'
    );
  });

  it('registers cors with the trusted origins when auth and origins are present', () => {
    expect(
      honoServerFileTemplate({ ...OPTIONS, hasAuth: true, trustedOrigins: ['https://app.com', 'https://admin.com'], mode: 'standalone' })
    ).toEqualTemplate('server-file', 'hono', 'auth-origins.txt');
  });

  it('sets no cross-origin headers on either route in embedded mode, where the host owns that policy', () => {
    expect(
      honoServerFileTemplate({ ...OPTIONS, hasAuth: true, trustedOrigins: ['https://app.com', 'https://admin.com'], mode: 'embedded' })
    ).toEqualTemplate('server-file', 'hono', 'embedded-auth-origins.txt');
  });

  it('serves the paths it was configured with, so mounting under a prefix still reaches it', () => {
    expect(
      honoServerFileTemplate({ ...OPTIONS, hasAuth: true, mode: 'embedded', actionsPath: '/typebase/rpc', authPath: '/typebase/auth' })
    ).toEqualTemplate('server-file', 'hono', 'embedded-custom-paths.txt');
  });

  it('normalizes trailing slashes in both configured paths', () => {
    expect(
      honoServerFileTemplate({ ...OPTIONS, hasAuth: true, mode: 'embedded', actionsPath: '/typebase/rpc///', authPath: '/typebase/auth/' })
    ).toEqualTemplate('server-file', 'hono', 'embedded-custom-paths.txt');
  });

  it('registers root paths without a doubled slash', () => {
    expect(honoServerFileTemplate({ ...OPTIONS, hasAuth: true, mode: 'embedded', actionsPath: '/', authPath: '/' })).toEqualTemplate(
      'server-file',
      'hono',
      'embedded-root-paths.txt'
    );
  });

  it('normalizes a runtime auth base path before registering its wildcard', () => {
    expect(honoServerFileTemplate({ ...OPTIONS, hasAuth: true, mode: 'embedded', authPath: { fromAuth: true } })).toEqualTemplate(
      'server-file',
      'hono',
      'embedded-dynamic-auth.txt'
    );
  });
});
