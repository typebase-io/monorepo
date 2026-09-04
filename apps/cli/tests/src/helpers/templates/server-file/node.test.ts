import { describe, expect, it } from 'vitest';

import { DEFAULT_ACTIONS_PATH, DEFAULT_AUTH_PATH } from '#helpers/constants.ts';
import { nodeServerFileTemplate } from '#helpers/templates/server-file/node.ts';
import { type ServerFileOptions } from '#helpers/templates/server-file/options.ts';

describe('nodeServerFileTemplate', () => {
  const OPTIONS = {
    routerCode: 'export const router = {};',
    hasAuth: false,
    trustedOrigins: [],
    mode: 'standalone',
    actionsPath: DEFAULT_ACTIONS_PATH,
    authPath: DEFAULT_AUTH_PATH,
  } satisfies ServerFileOptions;

  it('exports the mount and the router without auth', () => {
    expect(nodeServerFileTemplate({ ...OPTIONS, hasAuth: false, trustedOrigins: [], mode: 'standalone' })).toEqualTemplate(
      'server-file',
      'node',
      'no-auth.txt'
    );
  });

  it('exports auth alongside the simple auth handler when auth is enabled without trusted origins', () => {
    expect(nodeServerFileTemplate({ ...OPTIONS, hasAuth: true, trustedOrigins: [], mode: 'standalone' })).toEqualTemplate(
      'server-file',
      'node',
      'auth-no-origins.txt'
    );
  });

  it('renders the trusted-origins CORS handling when auth and origins are present', () => {
    expect(
      nodeServerFileTemplate({ ...OPTIONS, hasAuth: true, trustedOrigins: ['https://app.com', 'https://admin.com'], mode: 'standalone' })
    ).toEqualTemplate('server-file', 'node', 'auth-origins.txt');
  });

  it('sets no cross-origin headers on either route in embedded mode, where the host owns that policy', () => {
    expect(
      nodeServerFileTemplate({ ...OPTIONS, hasAuth: true, trustedOrigins: ['https://app.com', 'https://admin.com'], mode: 'embedded' })
    ).toEqualTemplate('server-file', 'node', 'embedded-auth-origins.txt');
  });

  it('serves the paths it was configured with, so mounting under a prefix still reaches it', () => {
    expect(
      nodeServerFileTemplate({ ...OPTIONS, hasAuth: true, mode: 'embedded', actionsPath: '/typebase/rpc', authPath: '/typebase/auth' })
    ).toEqualTemplate('server-file', 'node', 'embedded-custom-paths.txt');
  });

  it('normalizes trailing slashes in the actions prefix and auth path condition', () => {
    expect(
      nodeServerFileTemplate({ ...OPTIONS, hasAuth: true, mode: 'embedded', actionsPath: '/typebase/rpc///', authPath: '/typebase/auth/' })
    ).toEqualTemplate('server-file', 'node', 'embedded-custom-paths.txt');
  });

  it('keeps the root actions prefix a bare slash rather than an empty path', () => {
    expect(nodeServerFileTemplate({ ...OPTIONS, hasAuth: true, mode: 'embedded', actionsPath: '/', authPath: '/' })).toEqualTemplate(
      'server-file',
      'node',
      'embedded-root-paths.txt'
    );
  });
});
