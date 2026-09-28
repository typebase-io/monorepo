import { describe, expect, it } from 'vitest';

import { exampleStorageTemplate } from '#helpers/templates/example-storage.ts';

describe('exampleStorageTemplate', () => {
  it('renders a vercel storage declaring a public and a private bucket', () => {
    expect(exampleStorageTemplate).toEqualTemplate('example-storage', 'expected.txt');
  });
});
