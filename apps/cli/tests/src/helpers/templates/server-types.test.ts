import { describe, expect, it } from 'vitest';

import { serverTypesTemplate } from '#helpers/templates/server-types.ts';

const CASES: { fixture: string; description: string; hasDB: boolean; hasAuth: boolean; hasEnv: boolean; hasPublisher: boolean }[] = [
  {
    fixture: 'none.txt',
    description: 'an action with no providers',
    hasDB: false,
    hasAuth: false,
    hasEnv: false,
    hasPublisher: false,
  },
  {
    fixture: 'db.txt',
    description: 'an action with a database',
    hasDB: true,
    hasAuth: false,
    hasEnv: false,
    hasPublisher: false,
  },
  {
    fixture: 'auth.txt',
    description: 'an action with auth',
    hasDB: false,
    hasAuth: true,
    hasEnv: false,
    hasPublisher: false,
  },
  {
    fixture: 'env.txt',
    description: 'an action with an env schema',
    hasDB: false,
    hasAuth: false,
    hasEnv: true,
    hasPublisher: false,
  },
  {
    fixture: 'publisher.txt',
    description: 'an action with a publisher',
    hasDB: false,
    hasAuth: false,
    hasEnv: false,
    hasPublisher: true,
  },
  {
    fixture: 'db-auth.txt',
    description: 'an action with a database and auth',
    hasDB: true,
    hasAuth: true,
    hasEnv: false,
    hasPublisher: false,
  },
  {
    fixture: 'db-env.txt',
    description: 'an action with a database and an env schema',
    hasDB: true,
    hasAuth: false,
    hasEnv: true,
    hasPublisher: false,
  },
  {
    fixture: 'db-publisher.txt',
    description: 'an action with a database and a publisher',
    hasDB: true,
    hasAuth: false,
    hasEnv: false,
    hasPublisher: true,
  },
  {
    fixture: 'auth-env.txt',
    description: 'an action with auth and an env schema',
    hasDB: false,
    hasAuth: true,
    hasEnv: true,
    hasPublisher: false,
  },
  {
    fixture: 'auth-publisher.txt',
    description: 'an action with auth and a publisher',
    hasDB: false,
    hasAuth: true,
    hasEnv: false,
    hasPublisher: true,
  },
  {
    fixture: 'env-publisher.txt',
    description: 'an action with an env schema and a publisher',
    hasDB: false,
    hasAuth: false,
    hasEnv: true,
    hasPublisher: true,
  },
  {
    fixture: 'db-auth-env.txt',
    description: 'an action with a database, auth and an env schema',
    hasDB: true,
    hasAuth: true,
    hasEnv: true,
    hasPublisher: false,
  },
  {
    fixture: 'db-auth-publisher.txt',
    description: 'an action with a database, auth and a publisher',
    hasDB: true,
    hasAuth: true,
    hasEnv: false,
    hasPublisher: true,
  },
  {
    fixture: 'db-env-publisher.txt',
    description: 'an action with a database, an env schema and a publisher',
    hasDB: true,
    hasAuth: false,
    hasEnv: true,
    hasPublisher: true,
  },
  {
    fixture: 'auth-env-publisher.txt',
    description: 'an action with auth, an env schema and a publisher',
    hasDB: false,
    hasAuth: true,
    hasEnv: true,
    hasPublisher: true,
  },
  {
    fixture: 'all.txt',
    description: 'an action with a database, auth, an env schema and a publisher',
    hasDB: true,
    hasAuth: true,
    hasEnv: true,
    hasPublisher: true,
  },
];

describe('serverTypesTemplate', () => {
  const ROUTER = 'const router = {};';

  describe('when there are router imports', () => {
    const ROUTER_IMPORTS = 'import * as Action0 from "./actions/todos.ts";';

    it.each(CASES)('declares $description', ({ fixture, hasDB, hasAuth, hasEnv, hasPublisher }) => {
      expect(serverTypesTemplate(hasDB, hasAuth, hasEnv, hasPublisher, ROUTER_IMPORTS, ROUTER)).toEqualTemplate(
        'server-types',
        'with-router-imports',
        fixture
      );
    });
  });

  describe('when there are no router imports', () => {
    const ROUTER_IMPORTS = '';

    it.each(CASES)('declares $description', ({ fixture, hasDB, hasAuth, hasEnv, hasPublisher }) => {
      expect(serverTypesTemplate(hasDB, hasAuth, hasEnv, hasPublisher, ROUTER_IMPORTS, ROUTER)).toEqualTemplate(
        'server-types',
        'without-router-imports',
        fixture
      );
    });
  });
});
