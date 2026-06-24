import { describe, expect, it } from 'vitest';

import { dbTypesTemplate } from '#helpers/templates/db-types.ts';

describe('dbTypesTemplate', () => {
  it('renders the db types file with the auth session type when auth is present', () => {
    expect(dbTypesTemplate('./schema.ts', true)).toEqualTemplate('db-types', 'auth.txt');
  });

  it('renders the db types file without auth when auth is absent', () => {
    expect(dbTypesTemplate('./schema.ts', false)).toEqualTemplate('db-types', 'no-auth.txt');
  });
});
