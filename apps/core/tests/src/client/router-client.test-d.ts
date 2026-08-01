import { os } from '@orpc/server';
import { describe, expectTypeOf, it } from 'vitest';
import { z } from 'zod';

import { createRouterClient, createTanstackQueryClient } from '#client/router-client.ts';

import { filterActions } from '#server/actions/index.ts';

const _router = {
  todos: filterActions({
    getOne: os
      .input(z.object({ id: z.number() }))
      .output(z.object({ id: z.number(), value: z.string() }))
      .handler(async ({ input }) => ({ id: input.id, value: 'buy milk' })),
    NOT_AN_ACTION: 'constant',
  }),
};

type Router = typeof _router;

describe('createRouterClient', () => {
  it('types every action of the router as a local function', () => {
    const client = createRouterClient<Router>({ url: 'https://api.example.com' });

    expectTypeOf(client.todos.getOne).parameter(0).toEqualTypeOf<{ id: number }>();
    expectTypeOf(client.todos.getOne({ id: 1 })).resolves.toEqualTypeOf<{ id: number; value: string }>();
  });

  it('rejects an input that does not match the action', () => {
    const client = createRouterClient<Router>({ url: 'https://api.example.com' });

    // @ts-expect-error -- `id` must be a number.
    void client.todos.getOne({ id: '1' });
  });

  it('requires the router type parameter', () => {
    // @ts-expect-error -- without a router type the only accepted argument is the error message.
    createRouterClient({ url: 'https://api.example.com' });
  });

  it('requires a url', () => {
    // @ts-expect-error -- the link options must include a url.
    createRouterClient<Router>({});
  });
});

describe('createTanstackQueryClient', () => {
  it('exposes the tanstack query utils of every action', () => {
    const orpc = createTanstackQueryClient<Router>({ url: 'https://api.example.com' });

    expectTypeOf(orpc.todos.getOne.queryOptions({ input: { id: 1 } }).queryKey).toExtend<readonly unknown[]>();

    // @ts-expect-error -- `id` must be a number.
    void orpc.todos.getOne.queryOptions({ input: { id: '1' } });
  });

  it('requires the router type parameter', () => {
    // @ts-expect-error -- without a router type the only accepted argument is the error message.
    createTanstackQueryClient({ url: 'https://api.example.com' });
  });
});
