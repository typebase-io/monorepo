import { describe, expect, it } from 'vitest';

import { exampleSchemaTemplate } from '#helpers/templates/example-schema.ts';

const CASES: { fixture: string; description: string; withAuth: boolean; withPublisher: boolean }[] = [
  {
    fixture: 'no-auth.txt',
    description: 'the todos table on its own',
    withAuth: false,
    withPublisher: false,
  },
  {
    fixture: 'auth.txt',
    description: 'the todos table with a user foreign key',
    withAuth: true,
    withPublisher: false,
  },
  {
    fixture: 'publisher.txt',
    description: 'the todos table next to the events table the publisher keeps events in',
    withAuth: false,
    withPublisher: true,
  },
  {
    fixture: 'auth-and-publisher.txt',
    description: 'the todos table with a user foreign key, next to the events table',
    withAuth: true,
    withPublisher: true,
  },
];

describe('exampleSchemaTemplate', () => {
  it.each(CASES)('renders $description', ({ fixture, withAuth, withPublisher }) => {
    expect(exampleSchemaTemplate(withAuth, withPublisher)).toEqualTemplate('example-schema', fixture);
  });
});
