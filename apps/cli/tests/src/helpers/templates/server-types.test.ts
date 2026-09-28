import { describe, expect, it } from 'vitest';

import { serverTypesTemplate } from '#helpers/templates/server-types.ts';
import type { ServerFeatures } from '#helpers/templates/server.ts';

const CASES: { fixture: string; description: string; features: ServerFeatures }[] = [
  {
    fixture: 'storage.txt',
    description: 'an action with storage',
    features: { db: false, auth: false, env: false, publisher: false, storage: true },
  },
  {
    fixture: 'all-with-storage.txt',
    description: 'an action with every provider, storage included',
    features: { db: true, auth: true, env: true, publisher: true, storage: true },
  },
  {
    fixture: 'none.txt',
    description: 'an action with no providers',
    features: { db: false, auth: false, env: false, publisher: false, storage: false },
  },
  {
    fixture: 'db.txt',
    description: 'an action with a database',
    features: { db: true, auth: false, env: false, publisher: false, storage: false },
  },
  {
    fixture: 'auth.txt',
    description: 'an action with auth',
    features: { db: false, auth: true, env: false, publisher: false, storage: false },
  },
  {
    fixture: 'env.txt',
    description: 'an action with an env schema',
    features: { db: false, auth: false, env: true, publisher: false, storage: false },
  },
  {
    fixture: 'publisher.txt',
    description: 'an action with a publisher',
    features: { db: false, auth: false, env: false, publisher: true, storage: false },
  },
  {
    fixture: 'db-auth.txt',
    description: 'an action with a database and auth',
    features: { db: true, auth: true, env: false, publisher: false, storage: false },
  },
  {
    fixture: 'db-env.txt',
    description: 'an action with a database and an env schema',
    features: { db: true, auth: false, env: true, publisher: false, storage: false },
  },
  {
    fixture: 'db-publisher.txt',
    description: 'an action with a database and a publisher',
    features: { db: true, auth: false, env: false, publisher: true, storage: false },
  },
  {
    fixture: 'auth-env.txt',
    description: 'an action with auth and an env schema',
    features: { db: false, auth: true, env: true, publisher: false, storage: false },
  },
  {
    fixture: 'auth-publisher.txt',
    description: 'an action with auth and a publisher',
    features: { db: false, auth: true, env: false, publisher: true, storage: false },
  },
  {
    fixture: 'env-publisher.txt',
    description: 'an action with an env schema and a publisher',
    features: { db: false, auth: false, env: true, publisher: true, storage: false },
  },
  {
    fixture: 'db-auth-env.txt',
    description: 'an action with a database, auth and an env schema',
    features: { db: true, auth: true, env: true, publisher: false, storage: false },
  },
  {
    fixture: 'db-auth-publisher.txt',
    description: 'an action with a database, auth and a publisher',
    features: { db: true, auth: true, env: false, publisher: true, storage: false },
  },
  {
    fixture: 'db-env-publisher.txt',
    description: 'an action with a database, an env schema and a publisher',
    features: { db: true, auth: false, env: true, publisher: true, storage: false },
  },
  {
    fixture: 'auth-env-publisher.txt',
    description: 'an action with auth, an env schema and a publisher',
    features: { db: false, auth: true, env: true, publisher: true, storage: false },
  },
  {
    fixture: 'all.txt',
    description: 'an action with a database, auth, an env schema and a publisher',
    features: { db: true, auth: true, env: true, publisher: true, storage: false },
  },
];

describe('serverTypesTemplate', () => {
  const ROUTER = 'const router = {};';

  describe('when there are router imports', () => {
    const ROUTER_IMPORTS = 'import * as Action0 from "./actions/todos.ts";';

    it.each(CASES)('declares $description', ({ fixture, features }) => {
      expect(serverTypesTemplate(features, ROUTER_IMPORTS, ROUTER)).toEqualTemplate('server-types', 'with-router-imports', fixture);
    });
  });

  describe('when there are no router imports', () => {
    const ROUTER_IMPORTS = '';

    it.each(CASES)('declares $description', ({ fixture, features }) => {
      expect(serverTypesTemplate(features, ROUTER_IMPORTS, ROUTER)).toEqualTemplate('server-types', 'without-router-imports', fixture);
    });
  });
});
