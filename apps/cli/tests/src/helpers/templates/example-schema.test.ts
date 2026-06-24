import { describe, expect, it } from 'vitest';

import { exampleSchemaTemplate } from '#helpers/templates/example-schema.ts';

describe('exampleSchemaTemplate', () => {
  it('renders the todos table with a user foreign key when auth is enabled', () => {
    expect(exampleSchemaTemplate(true)).toEqualTemplate('example-schema', 'auth.txt');
  });

  it('renders the todos table without the user foreign key when auth is disabled', () => {
    expect(exampleSchemaTemplate(false)).toEqualTemplate('example-schema', 'no-auth.txt');
  });
});
