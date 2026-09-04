import { runInNewContext } from 'node:vm';

import { describe, expect, it } from 'vitest';

import { authPathCondition } from '#helpers/templates/server-file/auth-path-condition.ts';

describe('authPathCondition', () => {
  it.each([
    { authPath: '/api/auth', fixture: 'default' },
    { authPath: '/custom/auth/', fixture: 'trailing-slash' },
    { authPath: { fromAuth: true } as const, fixture: 'dynamic' },
  ])('renders the $fixture route condition', ({ authPath, fixture }) => {
    expect(authPathCondition(authPath)).toEqualTemplate('auth-path-condition', `${fixture}.txt`);
  });

  it.each([
    { url: '/api/auth', matches: true },
    { url: '/api/auth/', matches: true },
    { url: '/api/auth/sign-in/email', matches: true },
    { url: '/api/auth?callbackURL=/home', matches: true },
    { url: '/api/authors', matches: false },
    { url: '/api/authors?callbackURL=/api/auth', matches: false },
    { url: '/api/auth-extra', matches: false },
    { url: '/other?path=/api/auth', matches: false },
    { url: '/api/auth%2Fextra', matches: false },
  ])('matches $url: $matches', ({ url, matches }) => {
    expect(runInNewContext(authPathCondition('/api/auth'), { pathname: new URL(url, 'http://localhost').pathname })).toBe(matches);
  });

  it.each([
    { basePath: '/custom/auth', pathname: '/custom/auth', matches: true },
    { basePath: '/custom/auth', pathname: '/custom/auth/session', matches: true },
    { basePath: '/custom/auth', pathname: '/custom/authors', matches: false },
    { basePath: '/custom/auth/', pathname: '/custom/auth', matches: true },
    { basePath: '/custom/auth/', pathname: '/custom/auth/session', matches: true },
    { basePath: '/custom/auth/', pathname: '/custom/authors', matches: false },
    { basePath: undefined, pathname: '/api/auth/session', matches: true },
    { basePath: undefined, pathname: '/api/authors', matches: false },
    { basePath: '', pathname: '/api/auth', matches: true },
  ])('matches $pathname with runtime base path $basePath: $matches', ({ basePath, pathname, matches }) => {
    expect(runInNewContext(authPathCondition({ fromAuth: true }), { pathname, auth: { options: { basePath } } })).toBe(matches);
  });
});
