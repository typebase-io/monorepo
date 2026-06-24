import { describe, expect, it } from 'vitest';

import { serverTemplate } from '#helpers/templates/server.ts';

describe('serverTemplate', () => {
  it('renders a bare action when neither db nor auth is present', () => {
    expect(serverTemplate(false, false)).toEqualTemplate('server', 'none.txt');
  });

  it('renders the db provider and getDB helper when db is present', () => {
    expect(serverTemplate(true, false)).toEqualTemplate('server', 'db.txt');
  });

  it('renders the auth provider when auth is present', () => {
    expect(serverTemplate(false, true)).toEqualTemplate('server', 'auth.txt');
  });

  it('renders both providers when db and auth are present', () => {
    expect(serverTemplate(true, true)).toEqualTemplate('server', 'both.txt');
  });
});
