import { describe, expect, it } from 'vitest';

import { serverTypesTemplate } from '#helpers/templates/server-types.ts';

describe('serverTypesTemplate', () => {
  const ROUTER = 'const router = {};';

  describe('when there are router imports', () => {
    const ROUTER_IMPORTS = 'import * as Action0 from "./actions/todos.ts";';

    it('declares a plain ActionBuilder when neither db nor auth is present', () => {
      expect(serverTypesTemplate(false, false, ROUTER_IMPORTS, ROUTER)).toEqualTemplate('server-types', 'with-router-imports', 'none.txt');
    });

    it('declares a relations-parameterized ActionBuilder and getDB when db is present', () => {
      expect(serverTypesTemplate(true, false, ROUTER_IMPORTS, ROUTER)).toEqualTemplate('server-types', 'with-router-imports', 'db.txt');
    });

    it('declares an ActionBuilder parameterized with relations and auth when both are present', () => {
      expect(serverTypesTemplate(true, true, ROUTER_IMPORTS, ROUTER)).toEqualTemplate('server-types', 'with-router-imports', 'both.txt');
    });
  });

  describe('when there are no router imports', () => {
    const ROUTER_IMPORTS = '';

    it('declares a plain ActionBuilder when neither db nor auth is present', () => {
      expect(serverTypesTemplate(false, false, ROUTER_IMPORTS, ROUTER)).toEqualTemplate('server-types', 'without-router-imports', 'none.txt');
    });

    it('declares a relations-parameterized ActionBuilder and getDB when db is present', () => {
      expect(serverTypesTemplate(true, false, ROUTER_IMPORTS, ROUTER)).toEqualTemplate('server-types', 'without-router-imports', 'db.txt');
    });

    it('declares an ActionBuilder parameterized with relations and auth when both are present', () => {
      expect(serverTypesTemplate(true, true, ROUTER_IMPORTS, ROUTER)).toEqualTemplate('server-types', 'without-router-imports', 'both.txt');
    });
  });
});
