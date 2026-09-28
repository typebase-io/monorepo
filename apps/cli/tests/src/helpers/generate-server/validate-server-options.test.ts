import { describe, expect, it } from 'vitest';

import { validateServerOptions } from '#helpers/generate-server/validate-server-options.ts';

describe('validateServerOptions', () => {
  it.each([
    { mode: 'standalone', options: {} },
    { mode: 'standalone', options: { port: 3000 } },
    { mode: 'embedded', options: {} },
    { mode: 'embedded', options: { actionsPath: '/actions' } },
    { mode: 'embedded', options: { authPath: '/auth' } },
    { mode: 'embedded', options: { actionsPath: '/actions', authPath: '/auth' } },
    { mode: 'standalone', options: { localStorage: true } },
    { mode: 'embedded', options: { localStorage: true } },
    { mode: 'embedded', options: { localStorage: true, storagePath: '/files' } },
  ] as const)('accepts $options for a $mode server', ({ mode, options }) => {
    expect(() => {
      validateServerOptions({ mode, adapter: 'node', options });
    }).not.toThrow();
  });

  it.each([
    { flag: '--actions-path', options: { actionsPath: '/actions' } },
    { flag: '--auth-path', options: { authPath: '/auth' } },
    { flag: '--storage-path', options: { storagePath: '/files', localStorage: true } },
  ])('rejects an explicit $flag for a standalone server', ({ flag, options }) => {
    expect(() => {
      validateServerOptions({ mode: 'standalone', adapter: 'node', options });
    }).toThrow(
      `Refusing to generate a standalone server with \`${flag}\`: a standalone server owns its process and always serves the paths it was built with, so nothing would use it. Drop \`${flag}\`, or generate an embedded server with \`--embedded\`.`
    );
  });

  it('rejects an explicit port when the resolved mode is embedded', () => {
    expect(() => {
      validateServerOptions({ mode: 'embedded', adapter: 'node', options: { port: 3000 } });
    }).toThrow(
      'Refusing to generate an embedded server with `--port`: an embedded server is mounted by your application and never listens, so nothing would use it. Drop `--port`, or generate a standalone server.'
    );
  });

  it('rejects a storage path without local storage, which is the only thing served there', () => {
    expect(() => {
      validateServerOptions({ mode: 'embedded', adapter: 'node', options: { storagePath: '/files' } });
    }).toThrow(
      'Refusing to generate a server with `--storage-path` but no `--local-storage`: only local storage serves files from the generated server, so nothing would use the path. Drop `--storage-path`, or add `--local-storage`.'
    );
  });

  it.each(['standalone', 'embedded'] as const)('rejects local storage on a %s Cloudflare server, which has no disk', (mode) => {
    expect(() => {
      validateServerOptions({ mode, adapter: 'cloudflare', options: { localStorage: true } });
    }).toThrow(
      'Refusing to generate a Cloudflare server with `--local-storage`: local storage keeps files on disk, and a Worker has no disk to keep them on. Drop `--local-storage`, or choose another `--adapter`.'
    );
  });
});
