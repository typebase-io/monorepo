import { describe, expect, it } from 'vitest';

import { exampleCustomActionsTemplate } from '#helpers/templates/example-custom-actions-template.ts';

describe('exampleCustomActionsTemplate', () => {
  it('renders the example custom actions file', () => {
    expect(exampleCustomActionsTemplate).toEqualTemplate('example-custom-actions-template', 'expected.txt');
  });
});
