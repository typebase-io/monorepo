import { describe, expect, it } from 'vitest';

import * as server from '#server/index.ts';

describe('server entry point', () => {
  it('exports the server api', () => {
    expect(Object.keys(server).sort()).toEqual([
      'Action',
      'AuthError',
      'ServerError',
      'createAuthMiddleware',
      'createPublisher',
      'createStorage',
      'defineAuth',
      'defineEnv',
      'definePublisher',
      'defineStorage',
      'filterActions',
      'getEventMeta',
      'withEventMeta',
    ]);
  });
});
