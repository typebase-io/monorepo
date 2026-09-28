import { describe, expect, it } from 'vitest';

import { exampleStorageActionsTemplate } from '#helpers/templates/example-storage-actions.ts';

describe('exampleStorageActionsTemplate', () => {
  it('renders one action signing an upload URL and one signing a download URL', () => {
    expect(exampleStorageActionsTemplate).toEqualTemplate('example-storage-actions', 'expected.txt');
  });
});
