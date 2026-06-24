import { describe, expect, it } from 'vitest';

import { baseSchemaTemplate } from '#helpers/templates/base-schema.ts';

describe('baseSchemaTemplate', () => {
  it('renders the placeholder schema file', () => {
    expect(baseSchemaTemplate).toEqualTemplate('base-schema', 'expected.txt');
  });
});
