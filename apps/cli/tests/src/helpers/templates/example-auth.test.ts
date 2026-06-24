import { describe, expect, it } from 'vitest';

import { exampleAuthTemplate } from '#helpers/templates/example-auth.ts';

describe('exampleAuthTemplate', () => {
  it('renders the example auth file', () => {
    expect(exampleAuthTemplate).toEqualTemplate('example-auth', 'expected.txt');
  });
});
