import * as betterAuthPlugins from 'better-auth/plugins';
import { describe, expect, it } from 'vitest';

import * as plugins from '#server/auth/plugins.ts';

describe('server auth plugins entry point', () => {
  it('re-exports every better-auth server plugin', () => {
    expect(Object.keys(plugins).sort()).toEqual(Object.keys(betterAuthPlugins).sort());
  });

  it('exposes the plugins the docs point at', () => {
    expect(plugins).toHaveProperty('admin');
    expect(plugins).toHaveProperty('organization');
  });
});
