import { describe, expect, it } from 'vitest';

import { serverPathPrefix } from '#helpers/shared/server-path-prefix.ts';

describe('serverPathPrefix', () => {
  it.each([
    { serverPath: '/rpc', expected: '/rpc' },
    { serverPath: '/api/rpc', expected: '/api/rpc' },
  ])('passes $serverPath through unchanged', ({ serverPath, expected }) => {
    expect(serverPathPrefix(serverPath)).toBe(expected);
  });

  it.each([
    { serverPath: '/rpc/', expected: '/rpc' },
    { serverPath: '/rpc///', expected: '/rpc' },
    { serverPath: '/api/rpc//', expected: '/api/rpc' },
  ])('strips the trailing slashes from $serverPath', ({ serverPath, expected }) => {
    expect(serverPathPrefix(serverPath)).toBe(expected);
  });

  it.each(['/', '///', ''])('keeps the root path %j a bare slash rather than an empty string', (serverPath) => {
    expect(serverPathPrefix(serverPath)).toBe('/');
  });

  it.each(['/rpc', '/rpc/', '/api/rpc//', '/', '///', ''])('always returns a path oRPC accepts as a prefix for %j', (serverPath) => {
    const prefix = serverPathPrefix(serverPath);

    expect(prefix).not.toBe('');
    expect(prefix.startsWith('/')).toBe(true);
  });

  it.each(['/', '///', ''])('agrees with the prefix oRPC derives at runtime for %j', (serverPath) => {
    expect(serverPathPrefix(serverPath).replace(/\/$/, '') || undefined).toBeUndefined();
  });
});
