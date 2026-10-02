import { type Context, type MergedCurrentContext, type MergedInitialContext, type Schema } from '@orpc/server';
import { type RequestHeadersPluginContext } from '@orpc/server/plugins';
import { type AnyRelations } from 'drizzle-orm';

import { type Action } from '#server/actions/action.ts';
import { type DB } from '#server/actions/types.ts';
import { type PublisherInstance } from '#server/publisher/define-publisher.ts';
import { type StorageInstance } from '#server/storage/define-storage.ts';

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

interface StorageContext<TStorage> {
  storage: StorageInstance<TStorage>;
}

type Env<TRelations extends AnyRelations, TAuth, TEnv> = ([TEnv] extends [never] ? Record<never, never> : TEnv) &
  ([TRelations] extends [never] ? Record<never, never> : { DATABASE_URL: string }) &
  ([TAuth] extends [never] ? Record<never, never> : { BETTER_AUTH_SECRET: string });

type MaybeDbContext<TRelations extends AnyRelations> = [TRelations] extends [never] ? Record<never, never> : DbContext<TRelations>;
type MaybeAuthContext<TAuth> = [TAuth] extends [never] ? Record<never, never> : AuthContext<TAuth>;
type MaybePublisherContext<TPublisher> = [TPublisher] extends [never] ? Record<never, never> : PublisherContext<TPublisher>;
type MaybeStorageContext<TStorage> = [TStorage] extends [never] ? Record<never, never> : StorageContext<TStorage>;
type MaybeEnvContext<TRelations extends AnyRelations, TAuth, TEnv> =
  ProvidesContext<TRelations, TAuth, TEnv, never, never> extends false ? Record<never, never> : EnvContext<Simplify<Env<TRelations, TAuth, TEnv>>>;

type MiddlewareContext<TRelations extends AnyRelations, TAuth, TEnv, TPublisher, TStorage> = MaybeDbContext<TRelations> &
  MaybeAuthContext<TAuth> &
  MaybeEnvContext<TRelations, TAuth, TEnv> &
  MaybePublisherContext<TPublisher> &
  MaybeStorageContext<TStorage>;

type MiddlewareInitialContext<TRelations extends AnyRelations, TAuth, TEnv, TPublisher, TStorage> = Partial<
  MiddlewareContext<TRelations, TAuth, TEnv, TPublisher, TStorage>
> &
  Record<never, never>;

type ProvidesContext<TRelations extends AnyRelations, TAuth, TEnv, TPublisher, TStorage> = [TRelations] extends [never]
  ? [TAuth] extends [never]
    ? [TEnv] extends [never]
      ? [TPublisher] extends [never]
        ? [TStorage] extends [never]
          ? false
          : true
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

export type ActionBuilder<TRelations extends AnyRelations = never, TAuth = never, TEnv = never, TPublisher = never, TStorage = never> =
  ProvidesContext<TRelations, TAuth, TEnv, TPublisher, TStorage> extends false
    ? BuiltAction<RequestHeadersPluginContext & Record<never, never>, RequestHeadersPluginContext>
    : BuiltAction<
        MergedInitialContext<
          RequestHeadersPluginContext & Record<never, never>,
          MiddlewareInitialContext<TRelations, TAuth, TEnv, TPublisher, TStorage>,
          RequestHeadersPluginContext
        >,
        MergedCurrentContext<RequestHeadersPluginContext, MiddlewareContext<TRelations, TAuth, TEnv, TPublisher, TStorage>>
      >;
