import { type RequestHeadersPluginContext } from '@orpc/server/plugins';
import { describe, expectTypeOf, it } from 'vitest';
import { z } from 'zod';

import { p, q } from '#db/index.ts';

import { type ActionBuilder } from '#server/actions/index.ts';
import { type DB } from '#server/actions/types.ts';
import { defineAuth } from '#server/auth/index.ts';
import { defineEnv } from '#server/env/index.ts';
import { type PublisherInstance, definePublisher } from '#server/publisher/define-publisher.ts';

const todos = p.pgTable('todos', { id: p.integer().primaryKey(), userId: p.text().notNull() });
const users = p.pgTable('users', { id: p.text().primaryKey() });

const _relations = q.defineRelations({ todos, users }, (r) => ({
  todos: { user: r.one.users({ from: r.todos.userId, to: r.users.id }) },
}));

const _auth = defineAuth({ emailAndPassword: { enabled: true } });

const _env = defineEnv({ STRIPE_KEY: z.string() });

const _publisher = definePublisher({
  provider: 'db',
  events: { 'post.created': z.object({ id: z.number() }) },
});

type Relations = typeof _relations;
type Auth = typeof _auth;
type Env = typeof _env;
type Publisher = typeof _publisher;

type Context<TBuilder> = TBuilder extends { handler: (fn: (context: infer TContext) => never) => unknown } ? TContext : never;

describe('ActionBuilder', () => {
  describe('with nothing configured', () => {
    type Ctx = Context<ActionBuilder>;

    it('only provides the request headers', () => {
      expectTypeOf<Ctx>().toEqualTypeOf<RequestHeadersPluginContext>();
    });

    it('provides no db, auth or env', () => {
      expectTypeOf<Ctx>().not.toHaveProperty('db');
      expectTypeOf<Ctx>().not.toHaveProperty('auth');
      expectTypeOf<Ctx>().not.toHaveProperty('env');
    });

    it('behaves the same when the absent db, auth and env are spelled out', () => {
      expectTypeOf<Context<ActionBuilder<never, never, never>>>().toEqualTypeOf<Ctx>();
    });
  });

  describe('with a db', () => {
    type Ctx = Context<ActionBuilder<Relations, never, never>>;

    it('provides a db typed with the project relations', () => {
      expectTypeOf<Ctx['db']>().toEqualTypeOf<DB<Relations>>();
      expectTypeOf<Ctx['db']['query']>().toHaveProperty('todos');
      expectTypeOf<Ctx['db']['query']>().toHaveProperty('users');
    });

    it('provides an env with the database url', () => {
      expectTypeOf<Ctx['env']['DATABASE_URL']>().toEqualTypeOf<string>();
      expectTypeOf<Ctx['env']>().not.toHaveProperty('BETTER_AUTH_SECRET');
    });

    it('resolves the env to a flat object, so it hovers as its keys', () => {
      expectTypeOf<Ctx['env']>().toEqualTypeOf<{ DATABASE_URL: string }>();
    });

    it('provides no auth', () => {
      expectTypeOf<Ctx>().not.toHaveProperty('auth');
    });
  });

  describe('with auth', () => {
    type Ctx = Context<ActionBuilder<never, Auth, never>>;

    it('provides the auth instance', () => {
      expectTypeOf<Ctx['auth']>().toEqualTypeOf<Auth>();
    });

    it('provides an env with the auth secret', () => {
      expectTypeOf<Ctx['env']['BETTER_AUTH_SECRET']>().toEqualTypeOf<string>();
      expectTypeOf<Ctx['env']>().not.toHaveProperty('DATABASE_URL');
    });

    it('provides no db', () => {
      expectTypeOf<Ctx>().not.toHaveProperty('db');
    });
  });

  describe('with env', () => {
    type Ctx = Context<ActionBuilder<never, never, Env>>;

    it('provides the validated variables', () => {
      expectTypeOf<Ctx['env']['STRIPE_KEY']>().toEqualTypeOf<string>();
    });

    it('does not add the db or auth variables', () => {
      expectTypeOf<Ctx['env']>().not.toHaveProperty('DATABASE_URL');
      expectTypeOf<Ctx['env']>().not.toHaveProperty('BETTER_AUTH_SECRET');
    });

    it('provides no db or auth', () => {
      expectTypeOf<Ctx>().not.toHaveProperty('db');
      expectTypeOf<Ctx>().not.toHaveProperty('auth');
    });
  });

  describe('with a db and auth', () => {
    type Ctx = Context<ActionBuilder<Relations, Auth, never>>;

    it('provides both, plus the variables each one needs', () => {
      expectTypeOf<Ctx['db']>().toEqualTypeOf<DB<Relations>>();
      expectTypeOf<Ctx['auth']>().toEqualTypeOf<Auth>();
      expectTypeOf<Ctx['env']['DATABASE_URL']>().toEqualTypeOf<string>();
      expectTypeOf<Ctx['env']['BETTER_AUTH_SECRET']>().toEqualTypeOf<string>();
    });
  });

  describe('with a db and env', () => {
    type Ctx = Context<ActionBuilder<Relations, never, Env>>;

    it('merges the project variables with the database url', () => {
      expectTypeOf<Ctx['env']['STRIPE_KEY']>().toEqualTypeOf<string>();
      expectTypeOf<Ctx['env']['DATABASE_URL']>().toEqualTypeOf<string>();
      expectTypeOf<Ctx['env']>().not.toHaveProperty('BETTER_AUTH_SECRET');
    });
  });

  describe('with auth and env', () => {
    type Ctx = Context<ActionBuilder<never, Auth, Env>>;

    it('merges the project variables with the auth secret', () => {
      expectTypeOf<Ctx['env']['STRIPE_KEY']>().toEqualTypeOf<string>();
      expectTypeOf<Ctx['env']['BETTER_AUTH_SECRET']>().toEqualTypeOf<string>();
      expectTypeOf<Ctx['env']>().not.toHaveProperty('DATABASE_URL');
    });
  });

  describe('with a db, auth and env', () => {
    type Ctx = Context<ActionBuilder<Relations, Auth, Env>>;

    it('provides everything', () => {
      expectTypeOf<Ctx['db']>().toEqualTypeOf<DB<Relations>>();
      expectTypeOf<Ctx['auth']>().toEqualTypeOf<Auth>();
      expectTypeOf<Ctx['env']['STRIPE_KEY']>().toEqualTypeOf<string>();
      expectTypeOf<Ctx['env']['DATABASE_URL']>().toEqualTypeOf<string>();
      expectTypeOf<Ctx['env']['BETTER_AUTH_SECRET']>().toEqualTypeOf<string>();
    });

    it('merges the project variables and the injected ones into one flat object', () => {
      expectTypeOf<Ctx['env']>().toEqualTypeOf<{ STRIPE_KEY: string; DATABASE_URL: string; BETTER_AUTH_SECRET: string }>();
      expectTypeOf<keyof Ctx['env']>().toEqualTypeOf<'STRIPE_KEY' | 'DATABASE_URL' | 'BETTER_AUTH_SECRET'>();
    });

    it('still provides the request headers', () => {
      expectTypeOf<Ctx>().toExtend<RequestHeadersPluginContext>();
    });
  });

  describe('with a publisher', () => {
    type Ctx = Context<ActionBuilder<never, never, never, Publisher>>;

    it('provides the publisher the project declared', () => {
      expectTypeOf<Ctx['publisher']>().toEqualTypeOf<PublisherInstance<Publisher>>();
    });

    it('types the events it can publish', () => {
      expectTypeOf<Ctx['publisher']['publish']>().toBeCallableWith('post.created', { id: 1 });
    });

    it('types what a subscription yields', () => {
      expectTypeOf<Ctx['publisher']['subscribe']>().returns.resolves.toExtend<AsyncGenerator<{ id: number }, void, void>>();
    });

    it('provides no db or auth, and no env either since nothing needs one', () => {
      expectTypeOf<Ctx>().not.toHaveProperty('db');
      expectTypeOf<Ctx>().not.toHaveProperty('auth');
      expectTypeOf<Ctx>().not.toHaveProperty('env');
    });

    it('still provides the request headers', () => {
      expectTypeOf<Ctx>().toExtend<RequestHeadersPluginContext>();
    });
  });

  describe('with a db and a publisher', () => {
    type Ctx = Context<ActionBuilder<Relations, never, never, Publisher>>;

    it('provides both, plus the database url the db needs', () => {
      expectTypeOf<Ctx['db']>().toEqualTypeOf<DB<Relations>>();
      expectTypeOf<Ctx['publisher']>().toEqualTypeOf<PublisherInstance<Publisher>>();
      expectTypeOf<Ctx['env']['DATABASE_URL']>().toEqualTypeOf<string>();
    });
  });

  describe('with a db, auth, env and a publisher', () => {
    type Ctx = Context<ActionBuilder<Relations, Auth, Env, Publisher>>;

    it('provides everything at once', () => {
      expectTypeOf<Ctx['db']>().toEqualTypeOf<DB<Relations>>();
      expectTypeOf<Ctx['auth']>().toEqualTypeOf<Auth>();
      expectTypeOf<Ctx['publisher']>().toEqualTypeOf<PublisherInstance<Publisher>>();
      expectTypeOf<Ctx['env']>().toEqualTypeOf<{ STRIPE_KEY: string; DATABASE_URL: string; BETTER_AUTH_SECRET: string }>();
    });
  });

  describe('without a publisher', () => {
    it('keeps it off the context of a project that has everything else', () => {
      expectTypeOf<Context<ActionBuilder<Relations, Auth, Env>>>().not.toHaveProperty('publisher');
    });

    it('behaves the same when the absent publisher is spelled out', () => {
      expectTypeOf<Context<ActionBuilder<Relations, Auth, Env, never>>>().toEqualTypeOf<Context<ActionBuilder<Relations, Auth, Env>>>();
    });
  });
});
