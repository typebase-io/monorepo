import { type Context, type MergedCurrentContext, type MergedInitialContext, type Schema } from '@orpc/server';
import { type RequestHeadersPluginContext } from '@orpc/server/plugins';
import { type AnyRelations } from 'drizzle-orm';

import { type Action } from '#server/actions/action.ts';
import { type DB } from '#server/actions/types.ts';
import { type PublisherInstance } from '#server/publisher/define-publisher.ts';

export { Action } from '#server/actions/action.ts';
export { filterActions } from '#server/actions/filter-actions.ts';

export { getEventMeta, withEventMeta } from '@orpc/server';

export type { EventMeta, InferRouterInputs, InferRouterOutputs } from '@orpc/server';

export type { InferStreamEvent } from '#server/actions/types.ts';

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

interface PublisherContext<TPublisher> {
  publisher: PublisherInstance<TPublisher>;
}

type Env<TRelations extends AnyRelations, TAuth, TEnv> = ([TEnv] extends [never] ? Record<never, never> : TEnv) &
  ([TRelations] extends [never] ? Record<never, never> : { DATABASE_URL: string }) &
  ([TAuth] extends [never] ? Record<never, never> : { BETTER_AUTH_SECRET: string });

type MaybeDbContext<TRelations extends AnyRelations> = [TRelations] extends [never] ? Record<never, never> : DbContext<TRelations>;
type MaybeAuthContext<TAuth> = [TAuth] extends [never] ? Record<never, never> : AuthContext<TAuth>;
type MaybePublisherContext<TPublisher> = [TPublisher] extends [never] ? Record<never, never> : PublisherContext<TPublisher>;
type MaybeEnvContext<TRelations extends AnyRelations, TAuth, TEnv> =
  ProvidesContext<TRelations, TAuth, TEnv, never> extends false ? Record<never, never> : EnvContext<Simplify<Env<TRelations, TAuth, TEnv>>>;

type MiddlewareContext<TRelations extends AnyRelations, TAuth, TEnv, TPublisher> = MaybeDbContext<TRelations> &
  MaybeAuthContext<TAuth> &
  MaybeEnvContext<TRelations, TAuth, TEnv> &
  MaybePublisherContext<TPublisher>;

type MiddlewareInitialContext<TRelations extends AnyRelations, TAuth, TEnv, TPublisher> = Partial<
  MiddlewareContext<TRelations, TAuth, TEnv, TPublisher>
> &
  Record<never, never>;

type ProvidesContext<TRelations extends AnyRelations, TAuth, TEnv, TPublisher> = [TRelations] extends [never]
  ? [TAuth] extends [never]
    ? [TEnv] extends [never]
      ? [TPublisher] extends [never]
        ? false
        : true
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

export type ActionBuilder<TRelations extends AnyRelations = never, TAuth = never, TEnv = never, TPublisher = never> =
  ProvidesContext<TRelations, TAuth, TEnv, TPublisher> extends false
    ? BuiltAction<RequestHeadersPluginContext & Record<never, never>, RequestHeadersPluginContext>
    : BuiltAction<
        MergedInitialContext<
          RequestHeadersPluginContext & Record<never, never>,
          MiddlewareInitialContext<TRelations, TAuth, TEnv, TPublisher>,
          RequestHeadersPluginContext
        >,
        MergedCurrentContext<RequestHeadersPluginContext, MiddlewareContext<TRelations, TAuth, TEnv, TPublisher>>
      >;
