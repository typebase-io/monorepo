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
});
