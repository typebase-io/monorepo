import * as qCore from 'drizzle-orm';
import type { InferInsertModel, InferSelectModel, Table } from 'drizzle-orm';
import * as pCore from 'drizzle-orm/pg-core';

export const q = qCore;
export const p = pCore;

export type InferDB<TSchema> = {
  [K in keyof TSchema as TSchema[K] extends Table ? K : never]: TSchema[K] extends Table
    ? {
        insert: InferInsertModel<TSchema[K]>;
        select: InferSelectModel<TSchema[K]>;
      }
    : never;
};
