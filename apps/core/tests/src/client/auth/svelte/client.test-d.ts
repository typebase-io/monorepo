import type * as betterAuthsvelte from 'better-auth/svelte';
import { describe, expectTypeOf, it } from 'vitest';

import * as client from '#client/auth/svelte/client.ts';

describe('svelte client', () => {
  it('re-exports better-auth`s svelte client', () => {
    expectTypeOf(client.createAuthClient).toEqualTypeOf<typeof betterAuthsvelte.createAuthClient>();
  });

  it('exports nothing else', () => {
    expectTypeOf<keyof typeof client>().toEqualTypeOf<'createAuthClient'>();
  });
});
