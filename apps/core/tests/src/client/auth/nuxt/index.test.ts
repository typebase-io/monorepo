import { describe, expect, it } from 'vitest';

import * as index from '#client/auth/nuxt/index.ts';

describe('nuxt entry point', () => {
  it('exports the server-side auth helpers', () => {
    expect(Object.keys(index).sort()).toEqual(['getServerAuthCookie', 'getServerSession', 'proxyToTypebase']);
  });
});
