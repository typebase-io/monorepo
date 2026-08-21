import { describe, expect, test } from 'vitest';

import { serverTemplate } from '#helpers/templates/server.ts';

describe('serverTemplate', () => {
  test('when nothing present', () => {
    expect(serverTemplate(false, false, false, false)).toEqualTemplate('server', 'none.txt');
  });

  test('when only db is present', () => {
    expect(serverTemplate(true, false, false, false)).toEqualTemplate('server', 'db.txt');
  });

  test('when only auth is present', () => {
    expect(serverTemplate(false, true, false, false)).toEqualTemplate('server', 'auth.txt');
  });

  test('when only env is present', () => {
    expect(serverTemplate(false, false, true, false)).toEqualTemplate('server', 'env.txt');
  });

  test('when only publisher is present', () => {
    expect(serverTemplate(false, false, false, true)).toEqualTemplate('server', 'publisher.txt');
  });

  test('when db and auth are present', () => {
    expect(serverTemplate(true, true, false, false)).toEqualTemplate('server', 'db-and-auth.txt');
  });

  test('when db and env are present', () => {
    expect(serverTemplate(true, false, true, false)).toEqualTemplate('server', 'db-and-env.txt');
  });

  test('when db and publisher are present', () => {
    expect(serverTemplate(true, false, false, true)).toEqualTemplate('server', 'db-and-publisher.txt');
  });

  test('when auth and env are present', () => {
    expect(serverTemplate(false, true, true, false)).toEqualTemplate('server', 'auth-and-env.txt');
  });

  test('when auth and publisher are present', () => {
    expect(serverTemplate(false, true, false, true)).toEqualTemplate('server', 'auth-and-publisher.txt');
  });

  test('when env and publisher are present', () => {
    expect(serverTemplate(false, false, true, true)).toEqualTemplate('server', 'env-and-publisher.txt');
  });

  test('when db, auth and env are present', () => {
    expect(serverTemplate(true, true, true, false)).toEqualTemplate('server', 'db-auth-and-env.txt');
  });

  test('when db, auth and publisher are present', () => {
    expect(serverTemplate(true, true, false, true)).toEqualTemplate('server', 'db-auth-and-publisher.txt');
  });

  test('when db, env and publisher are present', () => {
    expect(serverTemplate(true, false, true, true)).toEqualTemplate('server', 'db-env-and-publisher.txt');
  });

  test('when auth, env and publisher are present', () => {
    expect(serverTemplate(false, true, true, true)).toEqualTemplate('server', 'auth-env-and-publisher.txt');
  });

  test('when db, auth, env and publisher are present', () => {
    expect(serverTemplate(true, true, true, true)).toEqualTemplate('server', 'all.txt');
  });
});
