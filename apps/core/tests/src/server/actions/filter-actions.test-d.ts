import { os } from '@orpc/server';
import { describe, expectTypeOf, it } from 'vitest';
import { z } from 'zod';

import { Action, type InferRouterInputs, type InferRouterOutputs, filterActions } from '#server/actions/index.ts';

const todos = filterActions({
  getOne: new Action(os)
    .input(z.object({ id: z.number() }))
    .output(z.object({ id: z.number(), value: z.string() }))
    .handler(async ({ input }) => ({ id: input.id, value: 'buy milk' })),

  create: new Action(os).input(z.object({ value: z.string() })).handler(async ({ input }) => ({ id: 1, value: input.value, completed: false })),

  removeCompleted: new Action(os).handler(async () => ({ ok: true })),

  NOT_AN_ACTION: 'helpers exported next to actions are not routed',
});

const _router = { todos };

describe('filterActions', () => {
  it('keeps the actions of a module', () => {
    expectTypeOf<keyof typeof todos>().toEqualTypeOf<'getOne' | 'create' | 'removeCompleted'>();
  });

  it('drops everything that is not an action', () => {
    expectTypeOf(todos).not.toHaveProperty('NOT_AN_ACTION');
  });

  it('resolves a module without actions to an empty object', () => {
    expectTypeOf<[keyof ReturnType<typeof filterActions<{ CONSTANT: number }>>]>().toEqualTypeOf<[never]>();
  });
});

describe('InferRouterInputs', () => {
  type Inputs = InferRouterInputs<typeof _router>;

  it('infers the input of every action from its schema', () => {
    expectTypeOf<Inputs['todos']['getOne']>().toEqualTypeOf<{ id: number }>();
    expectTypeOf<Inputs['todos']['create']>().toEqualTypeOf<{ value: string }>();
  });

  it('infers an unknown input for an action without an input schema', () => {
    expectTypeOf<Inputs['todos']['removeCompleted']>().toEqualTypeOf<unknown>();
  });
});

describe('InferRouterOutputs', () => {
  type Outputs = InferRouterOutputs<typeof _router>;

  it('infers the output from the output schema when there is one', () => {
    expectTypeOf<Outputs['todos']['getOne']>().toEqualTypeOf<{ id: number; value: string }>();
  });

  it('falls back to the handler return type when there is no output schema', () => {
    expectTypeOf<Outputs['todos']['create']>().toEqualTypeOf<{ id: number; value: string; completed: boolean }>();
    expectTypeOf<Outputs['todos']['removeCompleted']>().toEqualTypeOf<{ ok: boolean }>();
  });
});
