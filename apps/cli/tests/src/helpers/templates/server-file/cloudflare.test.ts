import { describe, expect, it } from 'vitest';

import { DEFAULT_ACTIONS_PATH, DEFAULT_AUTH_PATH } from '#helpers/constants.ts';
import { cloudflareServerFileTemplate } from '#helpers/templates/server-file/cloudflare.ts';
import { type ServerFileOptions } from '#helpers/templates/server-file/options.ts';

describe('cloudflareServerFileTemplate', () => {
  const OPTIONS = {
    routerCode: 'export const router = {};',
    hasAuth: false,
    trustedOrigins: [],
    mode: 'standalone',
    actionsPath: DEFAULT_ACTIONS_PATH,
    authPath: DEFAULT_AUTH_PATH,
  } satisfies ServerFileOptions;

  it('exports the worker fetch mount and the router without auth', () => {
    expect(cloudflareServerFileTemplate({ ...OPTIONS, hasAuth: false, mode: 'standalone' })).toEqualTemplate(
      'server-file',
      'cloudflare',
      'no-auth.txt'
    );
  });

  it('exports auth alongside the auth handler when auth is enabled', () => {
    expect(cloudflareServerFileTemplate({ ...OPTIONS, hasAuth: true, mode: 'standalone' })).toEqualTemplate('server-file', 'cloudflare', 'auth.txt');
  });

  it('sets no cross-origin headers in embedded mode, where the host owns that policy', () => {
    expect(cloudflareServerFileTemplate({ ...OPTIONS, hasAuth: true, mode: 'embedded' })).toEqualTemplate(
      'server-file',
      'cloudflare',
      'embedded-auth.txt'
    );
  });

  it('serves the paths it was configured with, so mounting under a prefix still reaches it', () => {
    expect(
      cloudflareServerFileTemplate({ ...OPTIONS, hasAuth: true, mode: 'embedded', actionsPath: '/typebase/rpc', authPath: '/typebase/auth' })
    ).toEqualTemplate('server-file', 'cloudflare', 'embedded-custom-paths.txt');
  });

  it('normalizes trailing slashes in the actions prefix and auth path condition', () => {
    expect(
      cloudflareServerFileTemplate({ ...OPTIONS, hasAuth: true, mode: 'embedded', actionsPath: '/typebase/rpc///', authPath: '/typebase/auth/' })
    ).toEqualTemplate('server-file', 'cloudflare', 'embedded-custom-paths.txt');
  });

  it('keeps the root actions prefix a bare slash rather than an empty path', () => {
    expect(cloudflareServerFileTemplate({ ...OPTIONS, hasAuth: true, mode: 'embedded', actionsPath: '/', authPath: '/' })).toEqualTemplate(
      'server-file',
      'cloudflare',
      'embedded-root-paths.txt'
    );
  });
});
