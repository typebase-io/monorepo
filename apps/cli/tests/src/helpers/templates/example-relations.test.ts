import { describe, expect, it } from 'vitest';

import { exampleRelationsTemplate } from '#helpers/templates/example-relations.ts';

const CASES: { fixture: string; description: string; withAuth: boolean; withPublisher: boolean }[] = [
  { fixture: 'no-auth.txt', description: 'empty todos relations', withAuth: false, withPublisher: false },
  { fixture: 'auth.txt', description: 'a user relation on todos', withAuth: true, withPublisher: false },
  { fixture: 'publisher.txt', description: 'an events entry beside the todos relations', withAuth: false, withPublisher: true },
  { fixture: 'auth-and-publisher.txt', description: 'a user relation on todos and an events entry', withAuth: true, withPublisher: true },
];

describe('exampleRelationsTemplate', () => {
  it.each(CASES)('renders $description', ({ fixture, withAuth, withPublisher }) => {
    expect(exampleRelationsTemplate(withAuth, withPublisher)).toEqualTemplate('example-relations', fixture);
  });
});
