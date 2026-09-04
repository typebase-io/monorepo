import { runInNewContext } from 'node:vm';

import { describe, expect, it } from 'vitest';

import { authPathExpressions } from '#helpers/templates/server-file/auth-path-expressions.ts';

describe('authPathExpressions', () => {
  it.each([
    { basePath: '/', wildcard: '/*' },
    { basePath: '/custom/auth', wildcard: '/custom/auth/*' },
    { basePath: '/custom/auth///', wildcard: '/custom/auth/*' },
  ])('registers $basePath as $wildcard for static and runtime auth paths', ({ basePath, wildcard }) => {
    expect(runInNewContext(authPathExpressions(basePath).wildcard)).toBe(wildcard);
    expect(runInNewContext(authPathExpressions({ fromAuth: true }).wildcard, { auth: { options: { basePath } } })).toBe(wildcard);
  });

  it.each([undefined, ''])('uses the default auth path when the runtime value is %j', (basePath) => {
    expect(runInNewContext(authPathExpressions({ fromAuth: true }).wildcard, { auth: { options: { basePath } } })).toBe('/api/auth/*');
  });
});
