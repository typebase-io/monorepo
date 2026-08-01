import type * as betterAuthvue from 'better-auth/vue';
import { describe, expectTypeOf, it } from 'vitest';

import * as client from '#client/auth/vue/client.ts';

describe('vue client', () => {
  it('re-exports better-auth`s vue client', () => {
    expectTypeOf(client.createAuthClient).toEqualTypeOf<typeof betterAuthvue.createAuthClient>();
  });

  it('exports nothing else', () => {
    expectTypeOf<keyof typeof client>().toEqualTypeOf<'createAuthClient'>();
  });
});
