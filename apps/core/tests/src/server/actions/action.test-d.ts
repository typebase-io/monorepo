import { type AsyncIteratorClass, type InferRouterOutputs, type RouterClient, os } from '@orpc/server';
import { describe, expectTypeOf, it } from 'vitest';
import { z } from 'zod';

import { Action } from '#server/actions/action.ts';
import { type InferStreamEvent } from '#server/actions/types.ts';

const base = os.$context<{ db: string }>();

declare const customIterator: () => AsyncIteratorObject<{ message: string }, void, void>;

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
    expectTypeOf(withInput).toHaveProperty('stream');
  });

  describe('event iterators', () => {
    it('gives a generator handler the context, the input and the event params', () => {
      new Action(base).input(z.object({ room: z.string() })).stream(async function* ({ input, db, lastEventId, signal }) {
        expectTypeOf(input).toEqualTypeOf<{ room: string }>();
        expectTypeOf(db).toEqualTypeOf<string>();
        expectTypeOf(lastEventId).toEqualTypeOf<string | undefined>();
        expectTypeOf(signal).toEqualTypeOf<AbortSignal | undefined>();

        yield { message: 'hello' };
      });
    });

    it('keeps the event params off a handler that does not stream', () => {
      new Action(base).handler(async (context) => {
        expectTypeOf(context).not.toHaveProperty('lastEventId');
        expectTypeOf(context).not.toHaveProperty('signal');

        return null;
      });
    });

    it('gives the client an async iterable of what the handler yields', () => {
      const _procedure = new Action(base).stream(async function* () {
        yield { message: 'hello' };
      });

      expectTypeOf<RouterClient<typeof _procedure>>().returns.resolves.toExtend<AsyncIteratorObject<{ message: string }, unknown, void>>();
    });

    it('types the events from the output schema', () => {
      const _procedure = new Action(base).output(z.object({ message: z.string() })).stream(async function* ({ lastEventId }) {
        expectTypeOf(lastEventId).toEqualTypeOf<string | undefined>();

        yield { message: 'hello' };
      });

      expectTypeOf<RouterClient<typeof _procedure>>().returns.resolves.toExtend<AsyncIteratorObject<{ message: string }, unknown, void>>();
    });

    it('refuses a generator that yields nothing when an output schema says what it owes the client', () => {
      const action = new Action(base).output(z.object({ message: z.string() }));

      // @ts-expect-error -- a stream that never yields sends the client nothing.
      action.stream(async function* () {}); // eslint-disable-line @typescript-eslint/no-empty-function
    });

    it('refuses a generator that yields nothing when there is no output schema either', () => {
      // @ts-expect-error -- a stream that never yields sends the client nothing.
      new Action(base).stream(async function* () {}); // eslint-disable-line @typescript-eslint/no-empty-function
    });

    it('refuses a generator that yields nothing on an action that takes an input', () => {
      const action = new Action(base).input(z.object({ room: z.string() }));

      // @ts-expect-error -- a stream that never yields sends the client nothing.
      action.stream(async function* () {}); // eslint-disable-line @typescript-eslint/no-empty-function
    });

    it('infers the event type from what an output-less generator yields', () => {
      const _procedure = new Action(base).stream(async function* () {
        yield { message: 'hello', at: 1 };
      });

      expectTypeOf<RouterClient<typeof _procedure>>().returns.resolves.toExtend<
        AsyncIteratorObject<{ message: string; at: number }, unknown, void>
      >();
    });

    it('constrains what a generator handler may yield to the output schema', () => {
      const action = new Action(base).output(z.object({ message: z.string() }));

      // @ts-expect-error -- the handler may only yield the shape declared by `output`.
      action.stream(async function* () {
        yield { message: 1 };
      });
    });

    it('lets a generator end with a bare return', () => {
      const _withOutput = new Action(base).output(z.object({ message: z.string() })).stream(async function* ({ signal }) {
        while (signal?.aborted !== true) {
          yield { message: 'hello' };

          return;
        }
      });

      const _withoutOutput = new Action(base).stream(async function* ({ signal }) {
        while (signal?.aborted !== true) {
          yield { message: 'hello' };

          return;
        }
      });

      expectTypeOf<RouterClient<typeof _withOutput>>().returns.resolves.toExtend<AsyncIteratorObject<{ message: string }, unknown, void>>();
      expectTypeOf<RouterClient<typeof _withoutOutput>>().returns.resolves.toExtend<AsyncIteratorObject<{ message: string }, unknown, void>>();
    });

    it('refuses a generator that returns an event instead of yielding it, since a return sends nothing', () => {
      const action = new Action(base).output(z.object({ message: z.string() }));

      // @ts-expect-error -- events reach the client by being yielded, so a returned value is a mistake.
      action.stream(async function* () {
        yield { message: 'hello' };

        return { message: 'hello' };
      });
    });

    it('refuses a returned event even when there is no output schema to check it against', () => {
      // @ts-expect-error -- events reach the client by being yielded, so a returned value is a mistake.
      new Action(base).stream(async function* () {
        yield { message: 'hello' };

        return { message: 'hello' };
      });
    });

    it('refuses a returned event on an action that takes an input', () => {
      const action = new Action(base).input(z.object({ room: z.string() }));

      // @ts-expect-error -- events reach the client by being yielded, so a returned value is a mistake.
      action.stream(async function* () {
        yield { message: 'hello' };

        return { message: 'hello' };
      });
    });

    it('reports the same event iterator whether or not the action declares an output schema', () => {
      const _withoutSchema = new Action(base).stream(async function* () {
        yield { message: 'hello' };
      });

      const _withSchema = new Action(base).output(z.object({ message: z.string() })).stream(async function* () {
        yield { message: 'hello' };
      });

      expectTypeOf<RouterClient<typeof _withoutSchema>>().returns.resolves.toEqualTypeOf<AsyncIteratorClass<{ message: string }, unknown, void>>();
      expectTypeOf<RouterClient<typeof _withSchema>>().returns.resolves.toEqualTypeOf<AsyncIteratorClass<{ message: string }, unknown, void>>();
    });

    it('reports the same event iterator whether or not the handler is a generator function', () => {
      const _fromGenerator = new Action(base).stream(async function* () {
        yield { message: 'hello' };
      });

      const _fromIterator = new Action(base).stream(customIterator);

      expectTypeOf<RouterClient<typeof _fromGenerator>>().returns.resolves.toEqualTypeOf<AsyncIteratorClass<{ message: string }, unknown, void>>();
      expectTypeOf<RouterClient<typeof _fromIterator>>().returns.resolves.toEqualTypeOf<AsyncIteratorClass<{ message: string }, unknown, void>>();
    });

    it('takes the same event iterator on an action that takes an input', () => {
      const _procedure = new Action(base).input(z.object({ room: z.string() })).stream(async function* () {
        yield { message: 'hello' };
      });

      expectTypeOf<RouterClient<typeof _procedure>>().returns.resolves.toEqualTypeOf<AsyncIteratorClass<{ message: string }, unknown, void>>();
    });

    it('exposes the yielded event through InferStreamEvent', () => {
      const _procedure = new Action(base).stream(async function* () {
        yield { message: 'hello' };
      });

      type Outputs = InferRouterOutputs<{ feed: typeof _procedure }>;

      expectTypeOf<InferStreamEvent<Outputs['feed']>>().toEqualTypeOf<{ message: string }>();
    });
  });
});
