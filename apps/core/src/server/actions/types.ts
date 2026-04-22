/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  type Context,
  type DecoratedProcedure,
  type ErrorMap,
  type InferSchemaInput,
  type InferSchemaOutput,
  type Meta,
  type Schema,
} from '@orpc/server';
import { type AnyRelations, type EmptyRelations } from 'drizzle-orm';
import { type NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Pool } from 'pg';

export type AnySchema = Schema<any, any>;

export type DB<TRelations extends AnyRelations = EmptyRelations> = NodePgDatabase<Record<string, never>, TRelations> & {
  $client: Pool;
};

export interface ActionWithInput<
  TInitialContext extends Context,
  TCurrentContext extends Context,
  TInputSchema extends AnySchema,
  _TOutputSchema extends AnySchema,
  TErrorMap extends ErrorMap,
  TMeta extends Meta,
> {
  'output'<USchema extends AnySchema>(
    schema: USchema
  ): ActionWithInputOutput<TInitialContext, TCurrentContext, TInputSchema, USchema, TErrorMap, TMeta>;

  'handler'<UFuncOutput>(
    fn: (params: { input: InferSchemaOutput<TInputSchema> } & TCurrentContext) => Promise<UFuncOutput>
  ): DecoratedProcedure<TInitialContext, TCurrentContext, TInputSchema, Schema<UFuncOutput, UFuncOutput>, TErrorMap, TMeta>;
}

export interface ActionWithOutput<
  TInitialContext extends Context,
  TCurrentContext extends Context,
  TInputSchema extends AnySchema,
  TOutputSchema extends AnySchema,
  TErrorMap extends ErrorMap,
  TMeta extends Meta,
> {
  'input'<USchema extends AnySchema>(
    schema: USchema
  ): ActionWithInputOutput<TInitialContext, TCurrentContext, USchema, TOutputSchema, TErrorMap, TMeta>;

  'handler'(
    fn: (params: TCurrentContext) => Promise<InferSchemaInput<TOutputSchema>>
  ): DecoratedProcedure<TInitialContext, TCurrentContext, TInputSchema, TOutputSchema, TErrorMap, TMeta>;
}

export interface ActionWithInputOutput<
  TInitialContext extends Context,
  TCurrentContext extends Context,
  TInputSchema extends AnySchema,
  TOutputSchema extends AnySchema,
  TErrorMap extends ErrorMap,
  TMeta extends Meta,
> {
  'handler'(
    fn: (params: { input: InferSchemaOutput<TInputSchema> } & TCurrentContext) => Promise<InferSchemaInput<TOutputSchema>>
  ): DecoratedProcedure<TInitialContext, TCurrentContext, TInputSchema, TOutputSchema, TErrorMap, TMeta>;
}
