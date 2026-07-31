import { describe, expect, it } from 'vitest';

import { serverTypesTemplate } from '#helpers/templates/server-types.ts';

const CASES: { fixture: string; hasDB: boolean; hasAuth: boolean; hasEnv: boolean; description: string }[] = [
  {
    fixture: 'none.txt',
    hasDB: false,
    hasAuth: false,
    hasEnv: false,
    description: 'a plain ActionBuilder when the project has none of them',
  },
  {
    fixture: 'db.txt',
    hasDB: true,
    hasAuth: false,
    hasEnv: false,
    description: 'a relations-parameterized ActionBuilder and getDB when db is present',
  },
  {
    fixture: 'auth.txt',
    hasDB: false,
    hasAuth: true,
    hasEnv: false,
    description: 'an auth-parameterized ActionBuilder when auth is present',
  },
  {
    fixture: 'env.txt',
    hasDB: false,
    hasAuth: false,
    hasEnv: true,
    description: 'the declared Env Schema when the project has one',
  },
  {
    fixture: 'db-auth.txt',
    hasDB: true,
    hasAuth: true,
    hasEnv: false,
    description: 'relations and auth when both are present',
  },
  {
    fixture: 'db-env.txt',
    hasDB: true,
    hasAuth: false,
    hasEnv: true,
    description: 'relations alongside the declared Env Schema, leaving DATABASE_URL to ActionBuilder',
  },
  {
    fixture: 'auth-env.txt',
    hasDB: false,
    hasAuth: true,
    hasEnv: true,
    description: 'auth alongside the declared Env Schema, leaving BETTER_AUTH_SECRET to ActionBuilder',
  },
  {
    fixture: 'db-auth-env.txt',
    hasDB: true,
    hasAuth: true,
    hasEnv: true,
    description: 'relations, auth and the declared Env Schema together',
  },
];

describe('serverTypesTemplate', () => {
  const ROUTER = 'const router = {};';

  describe('when there are router imports', () => {
    const ROUTER_IMPORTS = 'import * as Action0 from "./actions/todos.ts";';

    it.each(CASES)('declares $description', ({ fixture, hasDB, hasAuth, hasEnv }) => {
      expect(serverTypesTemplate(hasDB, hasAuth, hasEnv, ROUTER_IMPORTS, ROUTER)).toEqualTemplate('server-types', 'with-router-imports', fixture);
    });
  });

  describe('when there are no router imports', () => {
    const ROUTER_IMPORTS = '';

    it.each(CASES)('declares $description', ({ fixture, hasDB, hasAuth, hasEnv }) => {
      expect(serverTypesTemplate(hasDB, hasAuth, hasEnv, ROUTER_IMPORTS, ROUTER)).toEqualTemplate('server-types', 'without-router-imports', fixture);
    });
  });
});
