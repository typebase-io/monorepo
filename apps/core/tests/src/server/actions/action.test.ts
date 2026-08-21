import { ORPCError, ValidationError, call, getEventMeta, os, withEventMeta } from '@orpc/server';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { Action } from '#server/actions/action.ts';

describe('Action', () => {
  it('exposes the handler result through the built procedure', async () => {
    const action = new Action(os);
    const procedure = action.handler(async () => 'hello');

    await expect(call(procedure, undefined)).resolves.toBe('hello');
  });

  it('spreads the context and the input into a single handler argument', async () => {
    const base = os.$context<{ db: string }>();
    const action = new Action(base);

    const procedure = action.input(z.object({ id: z.number() })).handler(async ({ db, input }) => `${db}:${input.id}`);

    await expect(call(procedure, { id: 1 }, { context: { db: 'pg' } })).resolves.toBe('pg:1');
  });

  it('passes an undefined input when no input schema is set', async () => {
    const action = new Action(os);
    const procedure = action.handler(async (params) => (params as { input?: unknown }).input === undefined);

    await expect(call(procedure, undefined)).resolves.toBe(true);
  });

  it('rejects an input that does not match the schema with a 400', async () => {
    const action = new Action(os);
    const procedure = action.input(z.object({ id: z.number() })).handler(async ({ input }) => input.id);

    // @ts-expect-error -- deliberately calling with an input the schema rejects.
    const error = await call(procedure, { id: 'not-a-number' }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ORPCError);
    expect((error as ORPCError<string, unknown>).code).toBe('BAD_REQUEST');
    expect((error as ORPCError<string, unknown>).status).toBe(400);
    expect((error as ORPCError<string, unknown>).cause).toBeInstanceOf(ValidationError);
  });

  it('rejects an output that does not match the schema with a 500', async () => {
    const action = new Action(os);
    const procedure = action.output(z.object({ ok: z.boolean() })).handler(async () => ({ ok: 'yes' }) as unknown as { ok: boolean });

    const error = await call(procedure, undefined).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ORPCError);
    expect((error as ORPCError<string, unknown>).code).toBe('INTERNAL_SERVER_ERROR');
    expect((error as ORPCError<string, unknown>).cause).toBeInstanceOf(ValidationError);
  });

  it('accepts input and output schemas in either order', async () => {
    const inputFirst = new Action(os)
      .input(z.object({ value: z.string() }))
      .output(z.object({ value: z.string() }))
      .handler(async ({ input }) => input);

    const outputFirst = new Action(os)
      .output(z.object({ value: z.string() }))
      .input(z.object({ value: z.string() }))
      .handler(async ({ input }) => input);

    await expect(call(inputFirst, { value: 'a' })).resolves.toEqual({ value: 'a' });
    await expect(call(outputFirst, { value: 'b' })).resolves.toEqual({ value: 'b' });
  });

  it('coerces the input through the schema before the handler sees it', async () => {
    const action = new Action(os);
    const procedure = action.input(z.object({ id: z.coerce.number() })).handler(async ({ input }) => input.id + 1);

    await expect(call(procedure, { id: '41' } as unknown as { id: number })).resolves.toBe(42);
  });

  describe('use', () => {
    it('merges the middleware result into the handler context', async () => {
      const action = new Action(os.$context<{ token: string }>());

      const procedure = action.use(({ token }) => ({ user: { id: token } })).handler(async ({ user }) => user.id);

      await expect(call(procedure, undefined, { context: { token: 'abc' } })).resolves.toBe('abc');
    });

    it('keeps the context provided by previous middlewares', async () => {
      const action = new Action(os.$context<{ token: string }>());

      const procedure = action
        .use(({ token }) => ({ user: { id: token } }))
        .use(({ user }) => ({ role: user.id === 'admin' ? 'admin' : 'member' }))
        .handler(async ({ user, role }) => `${user.id}:${role}`);

      await expect(call(procedure, undefined, { context: { token: 'admin' } })).resolves.toBe('admin:admin');
    });

    it('awaits asynchronous middlewares', async () => {
      const action = new Action(os);

      const procedure = action
        .use(async () => {
          await Promise.resolve();

          return { loaded: true };
        })
        .handler(async ({ loaded }) => loaded);

      await expect(call(procedure, undefined)).resolves.toBe(true);
    });

    it('propagates errors thrown inside a middleware', async () => {
      const action = new Action(os);

      const procedure = action
        .use((): Record<never, never> => {
          throw new Error('unauthorized');
        })
        .handler(async () => 'never');

      await expect(call(procedure, undefined)).rejects.toThrow('unauthorized');
    });

    it('runs middlewares before the handler', async () => {
      const calls: string[] = [];
      const action = new Action(os);

      const procedure = action
        .use(() => {
          calls.push('middleware');

          return {};
        })
        .handler(async () => {
          calls.push('handler');

          return calls;
        });

      await expect(call(procedure, undefined)).resolves.toEqual(['middleware', 'handler']);
    });

    it('keeps `use` chainable with input and output', async () => {
      const procedure = new Action(os)
        .use(() => ({ multiplier: 2 }))
        .input(z.object({ value: z.number() }))
        .output(z.object({ result: z.number() }))
        .handler(async ({ input, multiplier }) => ({ result: input.value * multiplier }));

      await expect(call(procedure, { value: 21 })).resolves.toEqual({ result: 42 });
    });
  });

  describe('event iterators', () => {
    const collect = async <T>(iterator: AsyncIterable<T>) => {
      const events: T[] = [];

      for await (const event of iterator) {
        events.push(event);
      }

      return events;
    };

    it('streams what a generator handler yields', async () => {
      const action = new Action(os);

      const procedure = action.input(z.object({ room: z.string() })).stream(async function* ({ input }) {
        yield { message: `${input.room}:1` };
        yield { message: `${input.room}:2` };
      });

      await expect(collect(await call(procedure, { room: 'lobby' }))).resolves.toEqual([{ message: 'lobby:1' }, { message: 'lobby:2' }]);
    });

    it('gives the handler the id the client reconnected with', async () => {
      const action = new Action(os);

      const procedure = action.stream(async function* ({ lastEventId }) {
        yield { resumedFrom: lastEventId };
      });

      await expect(collect(await call(procedure, undefined, { lastEventId: '42' }))).resolves.toEqual([{ resumedFrom: '42' }]);
      await expect(collect(await call(procedure, undefined))).resolves.toEqual([{ resumedFrom: undefined }]);
    });

    it('gives the handler the signal that aborts when the client goes away', async () => {
      const controller = new AbortController();
      const action = new Action(os);

      const procedure = action.stream(async function* ({ signal }) {
        yield { aborted: signal?.aborted };
      });

      await expect(collect(await call(procedure, undefined, { signal: controller.signal }))).resolves.toEqual([{ aborted: false }]);
    });

    it('keeps the context and the middlewares a generator handler was built with', async () => {
      const action = new Action(os.$context<{ token: string }>());

      const procedure = action
        .use(({ token }) => ({ user: { id: token } }))
        .stream(async function* ({ user }) {
          yield { id: user.id };
        });

      await expect(collect(await call(procedure, undefined, { context: { token: 'abc' } }))).resolves.toEqual([{ id: 'abc' }]);
    });

    it('validates each event against the output schema', async () => {
      const action = new Action(os);

      const procedure = action.output(z.object({ message: z.string() })).stream(async function* () {
        yield { message: 'ok' };
      });

      await expect(collect(await call(procedure, undefined))).resolves.toEqual([{ message: 'ok' }]);
    });

    it('rejects an event that does not match the output schema', async () => {
      const action = new Action(os);

      const procedure = action.output(z.object({ message: z.string() })).stream(async function* () {
        yield { message: 1 } as unknown as { message: string };
      });

      const error = await collect(await call(procedure, undefined)).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ORPCError);
      expect((error as ORPCError<string, unknown>).code).toBe('EVENT_ITERATOR_VALIDATION_FAILED');
      expect((error as ORPCError<string, unknown>).cause).toBeInstanceOf(ValidationError);
    });

    it('carries the event metadata a handler attaches', async () => {
      const action = new Action(os);

      const procedure = action.stream(async function* () {
        yield withEventMeta({ message: 'hello' }, { id: 'event-1', retry: 5_000 });
      });

      const [event] = await collect(await call(procedure, undefined));

      expect(getEventMeta(event)).toEqual({ id: 'event-1', retry: 5_000 });
    });

    it('runs the cleanup a handler registers when the consumer stops early', async () => {
      const action = new Action(os);
      let cleanedUp = false;

      const procedure = action.stream(async function* () {
        try {
          yield { message: 'first' };
          yield { message: 'second' };
        } finally {
          cleanedUp = true;
        }
      });

      for await (const _event of await call(procedure, undefined)) {
        break;
      }

      expect(cleanedUp).toBe(true);
    });
  });

  it('does not mutate the action it was derived from', async () => {
    const base = new Action(os);
    const withInput = base.input(z.object({ id: z.number() }));

    expect(withInput).not.toBe(base);

    const withoutInput = base.handler(async (params) => (params as { input?: unknown }).input);

    await expect(call(withoutInput, undefined)).resolves.toBeUndefined();
  });
});
