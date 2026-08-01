// ⚠️ AUTO-GENERATED FILE — DO NOT EDIT

import type { ActionBuilder, GetDBBuilder, InferRouterInputs, InferRouterOutputs } from 'typebase-io/server';
import type { env as envSchema } from '../env.ts';
import type { relations } from '../db/relations.ts';

import { filterActions } from 'typebase-io/server';

import * as ActionModule0 from '../actions/mutations/todos.ts';
import * as ActionModule1 from '../actions/queries/todos.ts';

export const router = {
  mutations: {
    todos: filterActions(ActionModule0),
  },
  queries: {
    todos: filterActions(ActionModule1),
  },
};

export type Router = typeof router;
export type RouterInputs = InferRouterInputs<typeof router>;
export type RouterOutputs = InferRouterOutputs<typeof router>;

export declare const action: ActionBuilder<typeof relations, never, typeof envSchema>;
export declare const getDB: GetDBBuilder<typeof relations>;
