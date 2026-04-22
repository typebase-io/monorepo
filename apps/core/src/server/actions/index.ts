import { type MergedCurrentContext, type MergedInitialContext, type Schema } from '@orpc/server';
import { type RequestHeadersPluginContext } from '@orpc/server/plugins';
import { type AnyRelations, type EmptyRelations } from 'drizzle-orm';

import { type Action } from '#server/actions/action.ts';
import { type DB } from '#server/actions/types.ts';

export { Action } from '#server/actions/action.ts';

interface DbContext<TRelations extends AnyRelations> {
  db: DB<TRelations>;
}

interface AuthContext<TAuth> {
  auth: TAuth;
}

type MiddlewareContext<TRelations extends AnyRelations, TAuth> = [TAuth] extends [never]
  ? DbContext<TRelations>
  : DbContext<TRelations> & AuthContext<TAuth>;

type MiddlewareInitialContext<TRelations extends AnyRelations, TAuth> = [TAuth] extends [never]
  ? { db?: DB<TRelations> } & Record<never, never>
  : { db?: DB<TRelations>; auth?: TAuth } & Record<never, never>;

export type ActionBuilder<TRelations extends AnyRelations = EmptyRelations, TAuth = never> = EmptyRelations extends TRelations
  ? Action<
      RequestHeadersPluginContext & Record<never, never>,
      RequestHeadersPluginContext,
      Schema<unknown, unknown>,
      Schema<unknown, unknown>,
      Record<never, never>,
      Record<never, never>
    >
  : Action<
      MergedInitialContext<
        RequestHeadersPluginContext & Record<never, never>,
        MiddlewareInitialContext<TRelations, TAuth>,
        RequestHeadersPluginContext
      >,
      MergedCurrentContext<RequestHeadersPluginContext, MiddlewareContext<TRelations, TAuth>>,
      Schema<unknown, unknown>,
      Schema<unknown, unknown>,
      Record<never, never>,
      Record<never, never>
    >;
