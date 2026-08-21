import { describe, expect, it } from 'vitest';

import { exampleQueryActionTemplate } from '#helpers/templates/example-query-action.ts';

const CASES: { fixture: string; description: string; withAuth: boolean; withPublisher: boolean }[] = [
  { fixture: 'no-auth.txt', description: 'plain queries using the generated action', withAuth: false, withPublisher: false },
  { fixture: 'auth.txt', description: 'user-scoped queries using the authed action', withAuth: true, withPublisher: false },
  { fixture: 'publisher.txt', description: 'plain queries wired to the publisher', withAuth: false, withPublisher: true },
  { fixture: 'auth-and-publisher.txt', description: 'user-scoped queries wired to the publisher', withAuth: true, withPublisher: true },
];

describe('exampleQueryActionTemplate', () => {
  it.each(CASES)('renders $description', ({ fixture, withAuth, withPublisher }) => {
    expect(exampleQueryActionTemplate(withAuth, withPublisher)).toEqualTemplate('example-query-action', fixture);
  });
});
