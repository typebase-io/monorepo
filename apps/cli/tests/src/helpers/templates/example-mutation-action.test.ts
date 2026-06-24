import { describe, expect, it } from 'vitest';

import { exampleMutationActionTemplate } from '#helpers/templates/example-mutation-action.ts';

describe('exampleMutationActionTemplate', () => {
  it('renders user-scoped mutations using the authed action when auth is enabled', () => {
    expect(exampleMutationActionTemplate(true)).toEqualTemplate('example-mutation-action', 'auth.txt');
  });

  it('renders plain mutations using the generated action when auth is disabled', () => {
    expect(exampleMutationActionTemplate(false)).toEqualTemplate('example-mutation-action', 'no-auth.txt');
  });
});
