import * as orpcClientPlugins from '@orpc/client/plugins';
import { describe, expect, it } from 'vitest';

import * as plugins from '#client/plugins/index.ts';

describe('client plugins entry point', () => {
  it('re-exports every oRPC client plugin', () => {
    expect(Object.keys(plugins).sort()).toEqual(Object.keys(orpcClientPlugins).sort());
  });

  it('exposes the retry plugin a stream needs to reconnect', () => {
    expect(plugins).toHaveProperty('ClientRetryPlugin');
    expect(plugins.ClientRetryPlugin).toBe(orpcClientPlugins.ClientRetryPlugin);
  });
});
