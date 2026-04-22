// ⚠️ AUTO-GENERATED FILE — DO NOT EDIT

import type { ActionBuilder, GetDBBuilder } from 'typebase-io/server';
import type { relations } from '../db/relations.ts';

import * as MutationsTodos from '../actions/mutations/todos.ts';
import * as QueriesTodos from '../actions/queries/todos.ts';

export const router = {
	mutations: {
		todos: MutationsTodos
	},
	queries: {
		todos: QueriesTodos
	}
};

export type Router = typeof router;
export declare const action: ActionBuilder<typeof relations>;
export declare const getDB: GetDBBuilder<typeof relations>;
