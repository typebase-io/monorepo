import { describe, expect, it } from 'vitest';

import { exampleQueryActionTemplate } from '#helpers/templates/example-query-action.ts';

describe('exampleQueryActionTemplate', () => {
  it('renders user-scoped queries using the authed action when auth is enabled', () => {
    expect(exampleQueryActionTemplate(true)).toEqualTemplate('example-query-action', 'auth.txt');
  });

  it('renders plain queries using the generated action when auth is disabled', () => {
    expect(exampleQueryActionTemplate(false)).toEqualTemplate('example-query-action', 'no-auth.txt');
  });
});
