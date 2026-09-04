import { describe, expect, it } from 'vitest';

import { normalizeServerPath } from '#helpers/shared/normalize-server-path.ts';

describe('normalizeServerPath', () => {
  it.each([
    { serverPath: '/rpc', expected: '/rpc' },
    { serverPath: '/api/auth', expected: '/api/auth' },
  ])('leaves $serverPath alone when it has no trailing slash', ({ serverPath, expected }) => {
    expect(normalizeServerPath(serverPath)).toBe(expected);
  });

  it.each([
    { serverPath: '/rpc/', expected: '/rpc' },
    { serverPath: '/rpc///', expected: '/rpc' },
    { serverPath: '/api/auth/', expected: '/api/auth' },
    { serverPath: '/api/auth////', expected: '/api/auth' },
  ])('strips the trailing slashes from $serverPath', ({ serverPath, expected }) => {
    expect(normalizeServerPath(serverPath)).toBe(expected);
  });

  it.each([
    { serverPath: '/', expected: '' },
    { serverPath: '///', expected: '' },
    { serverPath: '', expected: '' },
  ])('collapses the root path $serverPath to an empty segment', ({ serverPath, expected }) => {
    expect(normalizeServerPath(serverPath)).toBe(expected);
  });

  it.each(['/rpc', '/api/auth/', '/'])('produces a wildcard without a doubled slash for %s', (serverPath) => {
    expect(`${normalizeServerPath(serverPath)}/*`).not.toContain('//');
  });

  it('only strips from the end, leaving interior slashes untouched', () => {
    expect(normalizeServerPath('/api//auth//')).toBe('/api//auth');
  });

  it('keeps the leading slash', () => {
    expect(normalizeServerPath('/rpc/').startsWith('/')).toBe(true);
  });
});
