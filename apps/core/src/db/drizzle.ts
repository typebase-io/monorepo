import * as qCore from 'drizzle-orm';
import type {
  ExtractTablesFromSchema,
  ExtractTablesWithRelations,
  InferInsertModel,
  InferSelectModel,
  RelationsBuilder,
  RelationsBuilderConfig,
  Schema,
  Table,
} from 'drizzle-orm';
import * as pCore from 'drizzle-orm/pg-core';

interface DefineRelations {
  <TSchema extends Record<string, unknown>, TTables extends Schema = ExtractTablesFromSchema<TSchema>>(
    schema: TSchema
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- mirrors drizzle's own signature for a schema without relations.
  ): ExtractTablesWithRelations<{}, TTables>;
  <
    TSchema extends Record<string, unknown>,
    TConfig extends Required<RelationsBuilderConfig<TTables>>,
    TTables extends Schema = ExtractTablesFromSchema<TSchema>,
  >(
    schema: TSchema,
    relations: (helpers: RelationsBuilder<TTables>) => TConfig
  ): ExtractTablesWithRelations<TConfig, TTables>;
}

export const q = qCore as Omit<typeof qCore, 'defineRelations'> & { defineRelations: DefineRelations };
export const p = pCore;

export type InferDB<TSchema> = {
  [K in keyof TSchema as TSchema[K] extends Table ? K : never]: TSchema[K] extends Table
    ? {
        insert: InferInsertModel<TSchema[K]>;
        select: InferSelectModel<TSchema[K]>;
      }
    : never;
};
