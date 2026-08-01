import { describe, expectTypeOf, it } from 'vitest';

import type * as clientModule from '#client/auth/vue/client.ts';
import type * as index from '#client/auth/vue/index.ts';

describe('vue entry point', () => {
  it('re-exports the client module', () => {
    expectTypeOf<typeof index>().toEqualTypeOf<typeof clientModule>();
  });

  it('exports nothing else', () => {
    expectTypeOf<keyof typeof index>().toEqualTypeOf<'createAuthClient'>();
  });
});
