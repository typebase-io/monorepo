import { describe, expect, it } from 'vitest';

import * as index from '#client/auth/svelte-kit/index.ts';

describe('svelte-kit entry point', () => {
  it('exports the server-side auth helpers', () => {
    expect(Object.keys(index).sort()).toEqual(['getServerAuthCookie', 'getServerSession', 'proxyToTypebase']);
  });
});
