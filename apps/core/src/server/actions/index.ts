import { type Context, type MergedCurrentContext, type MergedInitialContext, type Schema } from '@orpc/server';
import { type RequestHeadersPluginContext } from '@orpc/server/plugins';
import { type AnyRelations } from 'drizzle-orm';

import { type Action } from '#server/actions/action.ts';
import { type DB } from '#server/actions/types.ts';

export { Action } from '#server/actions/action.ts';
export { filterActions } from '#server/actions/filter-actions.ts';

export type { InferRouterInputs, InferRouterOutputs } from '@orpc/server';

type Simplify<T> = { -readonly [K in keyof T]: T[K] } & {};

interface DbContext<TRelations extends AnyRelations> {
  db: DB<TRelations>;
}

interface AuthContext<TAuth> {
  auth: TAuth;
}

interface EnvContext<TEnv> {
  env: TEnv;
}

type Env<TRelations extends AnyRelations, TAuth, TEnv> = ([TEnv] extends [never] ? Record<never, never> : TEnv) &
  ([TRelations] extends [never] ? Record<never, never> : { DATABASE_URL: string }) &
  ([TAuth] extends [never] ? Record<never, never> : { BETTER_AUTH_SECRET: string });

type MaybeDbContext<TRelations extends AnyRelations> = [TRelations] extends [never] ? Record<never, never> : DbContext<TRelations>;
type MaybeAuthContext<TAuth> = [TAuth] extends [never] ? Record<never, never> : AuthContext<TAuth>;
type MaybeEnvContext<TRelations extends AnyRelations, TAuth, TEnv> =
  ProvidesContext<TRelations, TAuth, TEnv> extends false ? Record<never, never> : EnvContext<Simplify<Env<TRelations, TAuth, TEnv>>>;

type MiddlewareContext<TRelations extends AnyRelations, TAuth, TEnv> = MaybeDbContext<TRelations> &
  MaybeAuthContext<TAuth> &
  MaybeEnvContext<TRelations, TAuth, TEnv>;

type MiddlewareInitialContext<TRelations extends AnyRelations, TAuth, TEnv> = Partial<MiddlewareContext<TRelations, TAuth, TEnv>> &
  Record<never, never>;

type ProvidesContext<TRelations extends AnyRelations, TAuth, TEnv> = [TRelations] extends [never]
  ? [TAuth] extends [never]
    ? [TEnv] extends [never]
      ? false
      : true
    : true
  : true;

type BuiltAction<TInitialContext extends Context, TCurrentContext extends Context> = Action<
  TInitialContext,
  TCurrentContext,
  Schema<unknown, unknown>,
  Schema<unknown, unknown>,
  Record<never, never>,
  Record<never, never>
>;

export type ActionBuilder<TRelations extends AnyRelations = never, TAuth = never, TEnv = never> =
  ProvidesContext<TRelations, TAuth, TEnv> extends false
    ? BuiltAction<RequestHeadersPluginContext & Record<never, never>, RequestHeadersPluginContext>
    : BuiltAction<
        MergedInitialContext<
          RequestHeadersPluginContext & Record<never, never>,
          MiddlewareInitialContext<TRelations, TAuth, TEnv>,
          RequestHeadersPluginContext
        >,
        MergedCurrentContext<RequestHeadersPluginContext, MiddlewareContext<TRelations, TAuth, TEnv>>
      >;
