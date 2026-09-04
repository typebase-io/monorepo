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
  ] as const)('accepts $options for a $mode server', ({ mode, options }) => {
    expect(() => {
      validateServerOptions({ mode, options });
    }).not.toThrow();
  });

  it.each([
    { flag: '--actions-path', options: { actionsPath: '/actions' } },
    { flag: '--auth-path', options: { authPath: '/auth' } },
  ])('rejects an explicit $flag for a standalone server', ({ flag, options }) => {
    expect(() => {
      validateServerOptions({ mode: 'standalone', options });
    }).toThrow(
      `Refusing to generate a standalone server with \`${flag}\`: a standalone server owns its process and always serves the paths it was built with, so nothing would use it. Drop \`${flag}\`, or generate an embedded server with \`--embedded\`.`
    );
  });

  it('rejects an explicit port when the resolved mode is embedded', () => {
    expect(() => {
      validateServerOptions({ mode: 'embedded', options: { port: 3000 } });
    }).toThrow(
      'Refusing to generate an embedded server with `--port`: an embedded server is mounted by your application and never listens, so nothing would use it. Drop `--port`, or generate a standalone server.'
    );
  });
});
