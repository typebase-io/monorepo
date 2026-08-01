import * as betterAuthClientPlugins from 'better-auth/client/plugins';
import { describe, expect, it } from 'vitest';

import * as plugins from '#client/auth/plugins.ts';

describe('client auth plugins entry point', () => {
  it('re-exports every better-auth client plugin', () => {
    expect(Object.keys(plugins).sort()).toEqual(Object.keys(betterAuthClientPlugins).sort());
  });

  it('exposes the plugins the docs point at', () => {
    expect(plugins).toHaveProperty('adminClient');
    expect(plugins).toHaveProperty('organizationClient');
  });
});
