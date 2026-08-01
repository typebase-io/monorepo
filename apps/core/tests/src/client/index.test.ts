import { describe, expect, it } from 'vitest';

import * as client from '#client/index.ts';
import * as routerClient from '#client/router-client.ts';

describe('client entry point', () => {
  it('exports the client factories', () => {
    expect(Object.keys(client).sort()).toEqual(['createRouterClient', 'createTanstackQueryClient']);
  });

  it('re-exports them from the router-client module', () => {
    expect(client.createRouterClient).toBe(routerClient.createRouterClient);
    expect(client.createTanstackQueryClient).toBe(routerClient.createTanstackQueryClient);
  });
});
