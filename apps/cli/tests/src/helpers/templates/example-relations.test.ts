import { describe, expect, it } from 'vitest';

import { exampleRelationsTemplate } from '#helpers/templates/example-relations.ts';

describe('exampleRelationsTemplate', () => {
  it('renders a user relation on todos when auth is enabled', () => {
    expect(exampleRelationsTemplate(true)).toEqualTemplate('example-relations', 'auth.txt');
  });

  it('renders empty todos relations when auth is disabled', () => {
    expect(exampleRelationsTemplate(false)).toEqualTemplate('example-relations', 'no-auth.txt');
  });
});
