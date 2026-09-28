import { describe, expect, test } from 'vitest';

import { serverTemplate } from '#helpers/templates/server.ts';

describe('serverTemplate', () => {
  test('when nothing present', () => {
    expect(serverTemplate({ db: false, auth: false, env: false, publisher: false, storage: false })).toEqualTemplate('server', 'none.txt');
  });

  test('when only db is present', () => {
    expect(serverTemplate({ db: true, auth: false, env: false, publisher: false, storage: false })).toEqualTemplate('server', 'db.txt');
  });

  test('when only auth is present', () => {
    expect(serverTemplate({ db: false, auth: true, env: false, publisher: false, storage: false })).toEqualTemplate('server', 'auth.txt');
  });

  test('when only env is present', () => {
    expect(serverTemplate({ db: false, auth: false, env: true, publisher: false, storage: false })).toEqualTemplate('server', 'env.txt');
  });

  test('when only publisher is present', () => {
    expect(serverTemplate({ db: false, auth: false, env: false, publisher: true, storage: false })).toEqualTemplate('server', 'publisher.txt');
  });

  test('when db and auth are present', () => {
    expect(serverTemplate({ db: true, auth: true, env: false, publisher: false, storage: false })).toEqualTemplate('server', 'db-and-auth.txt');
  });

  test('when db and env are present', () => {
    expect(serverTemplate({ db: true, auth: false, env: true, publisher: false, storage: false })).toEqualTemplate('server', 'db-and-env.txt');
  });

  test('when db and publisher are present', () => {
    expect(serverTemplate({ db: true, auth: false, env: false, publisher: true, storage: false })).toEqualTemplate('server', 'db-and-publisher.txt');
  });

  test('when auth and env are present', () => {
    expect(serverTemplate({ db: false, auth: true, env: true, publisher: false, storage: false })).toEqualTemplate('server', 'auth-and-env.txt');
  });

  test('when auth and publisher are present', () => {
    expect(serverTemplate({ db: false, auth: true, env: false, publisher: true, storage: false })).toEqualTemplate(
      'server',
      'auth-and-publisher.txt'
    );
  });

  test('when env and publisher are present', () => {
    expect(serverTemplate({ db: false, auth: false, env: true, publisher: true, storage: false })).toEqualTemplate('server', 'env-and-publisher.txt');
  });

  test('when db, auth and env are present', () => {
    expect(serverTemplate({ db: true, auth: true, env: true, publisher: false, storage: false })).toEqualTemplate('server', 'db-auth-and-env.txt');
  });

  test('when db, auth and publisher are present', () => {
    expect(serverTemplate({ db: true, auth: true, env: false, publisher: true, storage: false })).toEqualTemplate(
      'server',
      'db-auth-and-publisher.txt'
    );
  });

  test('when db, env and publisher are present', () => {
    expect(serverTemplate({ db: true, auth: false, env: true, publisher: true, storage: false })).toEqualTemplate(
      'server',
      'db-env-and-publisher.txt'
    );
  });

  test('when auth, env and publisher are present', () => {
    expect(serverTemplate({ db: false, auth: true, env: true, publisher: true, storage: false })).toEqualTemplate(
      'server',
      'auth-env-and-publisher.txt'
    );
  });

  test('when db, auth, env and publisher are present', () => {
    expect(serverTemplate({ db: true, auth: true, env: true, publisher: true, storage: false })).toEqualTemplate('server', 'all.txt');
  });

  test('when only storage is present', () => {
    expect(serverTemplate({ db: false, auth: false, env: false, publisher: false, storage: true })).toEqualTemplate('server', 'storage.txt');
  });

  test('when db, auth, env, publisher and storage are present', () => {
    expect(serverTemplate({ db: true, auth: true, env: true, publisher: true, storage: true })).toEqualTemplate('server', 'all-with-storage.txt');
  });
});
