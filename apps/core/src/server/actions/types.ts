/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  type AsyncIteratorClass,
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

export type AnyEventIterator = AsyncIteratorObject<any, void, any>;

type YieldedBy<TIterator> = TIterator extends AsyncIteratorObject<infer UYield, any, any> ? UYield : never;

export type MustYield<TIterator> = [YieldedBy<TIterator>] extends [never] ? { 'a stream must yield at least one event': never } : unknown;

export interface EventIteratorParams {
  lastEventId: string | undefined;
  signal: AbortSignal | undefined;
}

export type EventIteratorSchema<TSchema extends AnySchema> = Schema<
  AsyncIteratorObject<InferSchemaInput<TSchema>, unknown, void>,
  AsyncIteratorClass<InferSchemaOutput<TSchema>, unknown, void>
>;

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

  'stream'<UFuncOutput extends AnyEventIterator>(
    fn: (params: { input: InferSchemaOutput<TInputSchema> } & TCurrentContext & EventIteratorParams) => UFuncOutput & MustYield<UFuncOutput>
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

  'stream'<UIterator extends AsyncIteratorObject<InferSchemaInput<TOutputSchema>, void, any>>(
    fn: (params: TCurrentContext & EventIteratorParams) => UIterator & MustYield<UIterator>
  ): DecoratedProcedure<TInitialContext, TCurrentContext, TInputSchema, EventIteratorSchema<TOutputSchema>, TErrorMap, TMeta>;
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

  'stream'<UIterator extends AsyncIteratorObject<InferSchemaInput<TOutputSchema>, void, any>>(
    fn: (params: { input: InferSchemaOutput<TInputSchema> } & TCurrentContext & EventIteratorParams) => UIterator & MustYield<UIterator>
  ): DecoratedProcedure<TInitialContext, TCurrentContext, TInputSchema, EventIteratorSchema<TOutputSchema>, TErrorMap, TMeta>;
}
