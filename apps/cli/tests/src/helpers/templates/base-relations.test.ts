import { describe, expect, it } from 'vitest';

import { baseRelationsTemplate } from '#helpers/templates/base-relations.ts';

describe('baseRelationsTemplate', () => {
  it('renders the empty relations file', () => {
    expect(baseRelationsTemplate).toEqualTemplate('base-relations', 'expected.txt');
  });
});
