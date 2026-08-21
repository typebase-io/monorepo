import { describe, expect, it } from 'vitest';

import { exampleMutationActionTemplate } from '#helpers/templates/example-mutation-action.ts';

const CASES: { fixture: string; description: string; withAuth: boolean; withPublisher: boolean }[] = [
  { fixture: 'no-auth.txt', description: 'plain mutations using the generated action', withAuth: false, withPublisher: false },
  { fixture: 'auth.txt', description: 'user-scoped mutations using the authed action', withAuth: true, withPublisher: false },
  { fixture: 'publisher.txt', description: 'plain mutations wired to the publisher', withAuth: false, withPublisher: true },
  { fixture: 'auth-and-publisher.txt', description: 'user-scoped mutations wired to the publisher', withAuth: true, withPublisher: true },
];

describe('exampleMutationActionTemplate', () => {
  it.each(CASES)('renders $description', ({ fixture, withAuth, withPublisher }) => {
    expect(exampleMutationActionTemplate(withAuth, withPublisher)).toEqualTemplate('example-mutation-action', fixture);
  });
});
