import { describe, expect, it } from 'vitest';

import { DEFAULT_ACTIONS_PATH, DEFAULT_AUTH_PATH } from '#helpers/constants.ts';
import { validateServerPaths } from '#helpers/generate-server/validate-server-paths.ts';

describe('validateServerPaths', () => {
  it.each([
    { actionsPath: DEFAULT_ACTIONS_PATH, authPath: DEFAULT_AUTH_PATH },
    { actionsPath: '/rpc', authPath: '/auth' },
    { actionsPath: '/api/rpc', authPath: '/api/auth' },
    { actionsPath: '/apifoo', authPath: '/api' },
    { actionsPath: '/rpc/', authPath: '/auth/' },
    { actionsPath: '/', authPath: '/api/auth' },
  ])('accepts actions at $actionsPath alongside auth at $authPath', ({ actionsPath, authPath }) => {
    expect(() => {
      validateServerPaths({ actionsPath, authPath });
    }).not.toThrow();
  });

  it.each([
    { actionsPath: '/api', authPath: '/api/auth' },
    { actionsPath: '/', authPath: '/auth' },
  ])('accepts auth at $authPath nested inside actions at $actionsPath', ({ actionsPath, authPath }) => {
    expect(() => {
      validateServerPaths({ actionsPath, authPath });
    }).not.toThrow();
  });

  it.each([
    { actionsPath: '/rpc', authPath: '/rpc' },
    { actionsPath: '/api/rpc', authPath: '/api' },
    { actionsPath: '/api/nested/rpc', authPath: '/api' },
    { actionsPath: '/rpc', authPath: '/' },
    { actionsPath: '/', authPath: '/' },
    { actionsPath: '/api/rpc', authPath: '/api/' },
  ])('rejects auth at $authPath covering actions at $actionsPath', ({ actionsPath, authPath }) => {
    expect(() => {
      validateServerPaths({ actionsPath, authPath });
    }).toThrow(
      `Refusing to generate an embedded server that serves auth at \`${authPath}\` and actions at \`${actionsPath}\`: the generated server matches the auth path before your actions, so every action request would be answered by auth and never reach them. Serve auth at a path that does not contain the actions path.`
    );
  });

  describe('with a storage path', () => {
    it.each([
      { actionsPath: '/rpc', authPath: '/auth', storagePath: '/storage' },
      { actionsPath: '/api/rpc', authPath: '/api/auth', storagePath: '/api/storage' },
      { actionsPath: '/', authPath: '/auth', storagePath: '/storage' },
      { actionsPath: '/rpc', authPath: '/storage/auth', storagePath: '/storage' },
      { actionsPath: '/rpc', authPath: '/auth', storagePath: '/storagefoo' },
    ])('accepts storage at $storagePath alongside actions at $actionsPath and auth at $authPath', (paths) => {
      expect(() => {
        validateServerPaths(paths);
      }).not.toThrow();
    });

    it.each([
      { authPath: '/storage', storagePath: '/storage' },
      { authPath: '/api', storagePath: '/api/storage' },
      { authPath: '/files', storagePath: '/files/uploads' },
    ])('rejects auth at $authPath covering storage at $storagePath', ({ authPath, storagePath }) => {
      expect(() => {
        validateServerPaths({ actionsPath: '/rpc', authPath, storagePath });
      }).toThrow(
        `Refusing to generate an embedded server that serves auth at \`${authPath}\` and local storage at \`${storagePath}\`: the generated server matches the auth path before local storage, so every file request would be answered by auth. Serve local storage at a path outside the auth path.`
      );
    });

    it.each([
      { actionsPath: '/storage', storagePath: '/storage' },
      { actionsPath: '/api/rpc', storagePath: '/api' },
      { actionsPath: '/rpc', storagePath: '/' },
    ])('rejects storage at $storagePath covering actions at $actionsPath', ({ actionsPath, storagePath }) => {
      expect(() => {
        validateServerPaths({ actionsPath, authPath: '/auth', storagePath });
      }).toThrow(
        `Refusing to generate an embedded server that serves local storage at \`${storagePath}\` and actions at \`${actionsPath}\`: the generated server matches the storage path before your actions, so every action request would be answered by local storage. Serve local storage at a path that does not contain the actions path.`
      );
    });
  });
});
