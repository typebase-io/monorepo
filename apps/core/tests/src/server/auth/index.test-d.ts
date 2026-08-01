import { type Session, type User } from 'better-auth';
import { describe, expectTypeOf, it } from 'vitest';

import { defineAuth } from '#server/auth/index.ts';

const auth = defineAuth({
  emailAndPassword: { enabled: true },
  user: {
    additionalFields: {
      role: { type: 'string', required: true },
    },
  },
});

describe('defineAuth', () => {
  it('infers the session and user types of the instance', () => {
    expectTypeOf<typeof auth.$Infer.Session>().toExtend<{ session: Session; user: User }>();
  });

  it('carries additional user fields into the inferred user', () => {
    expectTypeOf<(typeof auth.$Infer.Session)['user']['role']>().toEqualTypeOf<string>();
  });

  it('keeps the options it was given on the instance', () => {
    expectTypeOf(auth.options.emailAndPassword).toEqualTypeOf<{ enabled: true }>();
  });

  it('does not accept a database — the CLI wires it up', () => {
    // @ts-expect-error -- `database` is owned by the generated server.
    defineAuth({ database: {} });
  });

  it('rejects unknown options', () => {
    // @ts-expect-error -- `notAnOption` is not a better-auth option.
    defineAuth({ notAnOption: true });
  });
});
