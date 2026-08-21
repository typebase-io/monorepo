import { describe, expect, it } from 'vitest';

import { baseSchemaTemplate } from '#helpers/templates/base-schema.ts';

describe('baseSchemaTemplate', () => {
  it('renders the placeholder schema file', () => {
    expect(baseSchemaTemplate(false)).toEqualTemplate('base-schema', 'expected.txt');
  });

  it('renders the placeholder schema file with the events table the publisher keeps events in', () => {
    expect(baseSchemaTemplate(true)).toEqualTemplate('base-schema', 'publisher.txt');
  });
});
