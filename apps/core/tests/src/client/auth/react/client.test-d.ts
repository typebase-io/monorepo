import type * as betterAuthreact from 'better-auth/react';
import { describe, expectTypeOf, it } from 'vitest';

import * as client from '#client/auth/react/client.ts';

describe('react client', () => {
  it('re-exports better-auth`s react client', () => {
    expectTypeOf(client.createAuthClient).toEqualTypeOf<typeof betterAuthreact.createAuthClient>();
  });

  it('exports nothing else', () => {
    expectTypeOf<keyof typeof client>().toEqualTypeOf<'createAuthClient'>();
  });
});
