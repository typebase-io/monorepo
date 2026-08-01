import { type RouterClient, os } from '@orpc/server';
import { describe, expectTypeOf, it } from 'vitest';
import { z } from 'zod';

import { Action } from '#server/actions/action.ts';

const base = os.$context<{ db: string }>();

describe('Action', () => {
  it('infers the handler output as the procedure output', () => {
    const _procedure = new Action(base).handler(async () => ({ id: 1 }));

    expectTypeOf<RouterClient<typeof _procedure>>().returns.resolves.toEqualTypeOf<{ id: number }>();
  });

  it('gives the handler the context of the builder it was created from', () => {
    new Action(base).handler(async (context) => {
      expectTypeOf(context.db).toEqualTypeOf<string>();

      return null;
    });
  });

  it('infers the parsed input from the input schema', () => {
    new Action(base).input(z.object({ id: z.coerce.number() })).handler(async ({ input, db }) => {
      expectTypeOf(input).toEqualTypeOf<{ id: number }>();
      expectTypeOf(db).toEqualTypeOf<string>();

      return null;
    });
  });

  it('exposes the client input of the procedure, before coercion', () => {
    const _procedure = new Action(base)
      .input(z.object({ id: z.coerce.number() }))
      .output(z.object({ ok: z.boolean() }))
      .handler(async () => ({ ok: true }));

    expectTypeOf<RouterClient<typeof _procedure>>().parameter(0).toEqualTypeOf<{ id: unknown }>();
    expectTypeOf<RouterClient<typeof _procedure>>().returns.resolves.toEqualTypeOf<{ ok: boolean }>();
  });

  it('constrains the handler return type to the output schema', () => {
    const action = new Action(base).output(z.object({ ok: z.boolean() }));

    // @ts-expect-error -- the handler must return the shape declared by `output`.
    action.handler(async () => ({ ok: 'yes' }));
  });

  it('does not expose an input to the handler until a schema is set', () => {
    new Action(base).handler(async (context) => {
      expectTypeOf(context).not.toHaveProperty('input');

      return null;
    });
  });

  it('adds the middleware context for the handler', () => {
    new Action(base)
      .use(({ db }) => ({ user: { id: db } }))
      .handler(async ({ user, db }) => {
        expectTypeOf(user).toEqualTypeOf<{ id: string }>();
        expectTypeOf(db).toEqualTypeOf<string>();

        return null;
      });
  });

  it('accumulates the context across chained middlewares', () => {
    new Action(base)
      .use(() => ({ user: { id: '1' } }))
      .use(({ user }) => ({ isAdmin: user.id === '1' }))
      .handler(async ({ user, isAdmin }) => {
        expectTypeOf(user).toEqualTypeOf<{ id: string }>();
        expectTypeOf(isAdmin).toEqualTypeOf<boolean>();

        return null;
      });
  });

  it('rejects a middleware that overwrites an existing context value with another type', () => {
    // @ts-expect-error -- `db` is a string in the current context, so it cannot be replaced by a number.
    new Action(base).use(() => ({ db: 1 }));
  });

  it('keeps input, output and middlewares chainable in any order', () => {
    const _inputFirst = new Action(base)
      .input(z.object({ value: z.string() }))
      .output(z.object({ value: z.string() }))
      .handler(async ({ input }) => input);

    const _useLast = new Action(base)
      .output(z.object({ value: z.string() }))
      .input(z.object({ value: z.string() }))
      .handler(async ({ input }) => input);

    expectTypeOf<RouterClient<typeof _inputFirst>>().returns.resolves.toEqualTypeOf<{ value: string }>();
    expectTypeOf<RouterClient<typeof _useLast>>().returns.resolves.toEqualTypeOf<{ value: string }>();
  });

  it('drops `use` once an input or output schema is set', () => {
    const withInput = new Action(base).input(z.object({ value: z.string() }));

    expectTypeOf(withInput).not.toHaveProperty('use');
    expectTypeOf(withInput).not.toHaveProperty('input');
    expectTypeOf(withInput).toHaveProperty('output');
    expectTypeOf(withInput).toHaveProperty('handler');
  });
});
