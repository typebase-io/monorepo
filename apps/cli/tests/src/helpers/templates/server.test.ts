import { describe, expect, test } from 'vitest';

import { serverTemplate } from '#helpers/templates/server.ts';

describe('serverTemplate', () => {
  test('when nothing present', () => {
    expect(serverTemplate(false, false, false)).toEqualTemplate('server', 'none.txt');
  });

  test('when only db is present', () => {
    expect(serverTemplate(true, false, false)).toEqualTemplate('server', 'db.txt');
  });

  test('when only auth is present', () => {
    expect(serverTemplate(false, true, false)).toEqualTemplate('server', 'auth.txt');
  });

  test('when only env is present', () => {
    expect(serverTemplate(false, false, true)).toEqualTemplate('server', 'env.txt');
  });

  test('when db and auth are present', () => {
    expect(serverTemplate(true, true, false)).toEqualTemplate('server', 'db-and-auth.txt');
  });

  test('when db and env are present', () => {
    expect(serverTemplate(true, false, true)).toEqualTemplate('server', 'db-and-env.txt');
  });

  test('when auth and env are present', () => {
    expect(serverTemplate(false, true, true)).toEqualTemplate('server', 'auth-and-env.txt');
  });

  test('when db, auth and env are present', () => {
    expect(serverTemplate(true, true, true)).toEqualTemplate('server', 'all.txt');
  });
});
