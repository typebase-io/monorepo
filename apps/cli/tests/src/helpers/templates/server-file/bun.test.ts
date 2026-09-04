import { describe, expect, it } from 'vitest';

import { DEFAULT_ACTIONS_PATH, DEFAULT_AUTH_PATH } from '#helpers/constants.ts';
import { bunServerFileTemplate } from '#helpers/templates/server-file/bun.ts';
import { type ServerFileOptions } from '#helpers/templates/server-file/options.ts';

describe('bunServerFileTemplate', () => {
  const OPTIONS = {
    routerCode: 'export const router = {};',
    hasAuth: false,
    trustedOrigins: [],
    mode: 'standalone',
    actionsPath: DEFAULT_ACTIONS_PATH,
    authPath: DEFAULT_AUTH_PATH,
  } satisfies ServerFileOptions;

  it('exports the fetch mount and the router without auth', () => {
    expect(bunServerFileTemplate({ ...OPTIONS, hasAuth: false, mode: 'standalone' })).toEqualTemplate('server-file', 'bun', 'no-auth.txt');
  });

  it('exports auth alongside the auth handler when auth is enabled', () => {
    expect(bunServerFileTemplate({ ...OPTIONS, hasAuth: true, mode: 'standalone' })).toEqualTemplate('server-file', 'bun', 'auth.txt');
  });

  it('sets no cross-origin headers in embedded mode, where the host owns that policy', () => {
    expect(bunServerFileTemplate({ ...OPTIONS, hasAuth: true, mode: 'embedded' })).toEqualTemplate('server-file', 'bun', 'embedded-auth.txt');
  });

  it('serves the paths it was configured with, so mounting under a prefix still reaches it', () => {
    expect(
      bunServerFileTemplate({ ...OPTIONS, hasAuth: true, mode: 'embedded', actionsPath: '/typebase/rpc', authPath: '/typebase/auth' })
    ).toEqualTemplate('server-file', 'bun', 'embedded-custom-paths.txt');
  });

  it('normalizes trailing slashes in the actions prefix and auth path condition', () => {
    expect(
      bunServerFileTemplate({ ...OPTIONS, hasAuth: true, mode: 'embedded', actionsPath: '/typebase/rpc///', authPath: '/typebase/auth/' })
    ).toEqualTemplate('server-file', 'bun', 'embedded-custom-paths.txt');
  });

  it('keeps the root actions prefix a bare slash rather than an empty path', () => {
    expect(bunServerFileTemplate({ ...OPTIONS, hasAuth: true, mode: 'embedded', actionsPath: '/', authPath: '/' })).toEqualTemplate(
      'server-file',
      'bun',
      'embedded-root-paths.txt'
    );
  });
});
