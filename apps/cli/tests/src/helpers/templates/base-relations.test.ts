import { describe, expect, it } from 'vitest';

import { baseRelationsTemplate } from '#helpers/templates/base-relations.ts';

describe('baseRelationsTemplate', () => {
  it('renders the empty relations file', () => {
    expect(baseRelationsTemplate(false)).toEqualTemplate('base-relations', 'expected.txt');
  });

  it('renders the relations file with nothing but the events entry', () => {
    expect(baseRelationsTemplate(true)).toEqualTemplate('base-relations', 'publisher.txt');
  });
});
