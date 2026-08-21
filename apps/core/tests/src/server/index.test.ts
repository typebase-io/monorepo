import { describe, expect, it } from 'vitest';

import * as server from '#server/index.ts';

describe('server entry point', () => {
  it('exports the server api', () => {
    expect(Object.keys(server).sort()).toEqual([
      'Action',
      'AuthError',
      'ServerError',
      'createAuthMiddleware',
      'defineAuth',
      'defineEnv',
      'filterActions',
      'getEventMeta',
      'withEventMeta',
    ]);
  });
});
