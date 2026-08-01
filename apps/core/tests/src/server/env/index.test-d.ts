import { describe, expectTypeOf, it } from 'vitest';
import { z } from 'zod';

import { defineEnv } from '#server/env/index.ts';

describe('defineEnv', () => {
  it('infers a property per variable, with the schema output type', () => {
    const env = defineEnv({
      DATABASE_URL: z.string(),
      PORT: z.coerce.number(),
      DEBUG: z.stringbool(),
    });

    expectTypeOf(env.DATABASE_URL).toEqualTypeOf<string>();
    expectTypeOf(env.PORT).toEqualTypeOf<number>();
    expectTypeOf(env.DEBUG).toEqualTypeOf<boolean>();
  });

  it('narrows literal unions', () => {
    const env = defineEnv({ NODE_ENV: z.enum(['development', 'production']) });

    expectTypeOf(env.NODE_ENV).toEqualTypeOf<'development' | 'production'>();
  });

  it('keeps optional variables optional', () => {
    const env = defineEnv({ SENTRY_DSN: z.string().optional() });

    expectTypeOf(env.SENTRY_DSN).toEqualTypeOf<string | undefined>();
  });

  it('does not expose variables that are not in the schema', () => {
    const env = defineEnv({ DATABASE_URL: z.string() });

    expectTypeOf(env).not.toHaveProperty('NOT_IN_SCHEMA');
  });

  it('rejects a schema entry that is not a standard schema', () => {
    // @ts-expect-error -- every entry must be a standard-schema validator.
    defineEnv({ DATABASE_URL: 'string' });
  });

  it('accepts only the documented options', () => {
    defineEnv({ DATABASE_URL: z.string() }, { emptyStringAsUndefined: false, skipValidation: true });

    // @ts-expect-error -- `runtimeEnv` is set by `defineEnv` itself.
    defineEnv({ DATABASE_URL: z.string() }, { runtimeEnv: {} });
  });
});
