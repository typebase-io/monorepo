import { APIError, createAuthMiddleware as betterAuthCreateAuthMiddleware } from 'better-auth/api';
import { describe, expect, it } from 'vitest';

import { AuthError, createAuthMiddleware, defineAuth } from '#server/auth/index.ts';

const auth = defineAuth({
  baseURL: 'http://localhost:3000',
  trustedOrigins: ['http://localhost:3000'],
  emailAndPassword: { enabled: true },
});

describe('defineAuth', () => {
  it('returns a better-auth instance', () => {
    expect(typeof auth.handler).toBe('function');
    expect(typeof auth.api).toBe('object');
    expect(typeof auth.api.getSession).toBe('function');
  });

  it('keeps the options it was given', () => {
    expect(auth.options.trustedOrigins).toEqual(['http://localhost:3000']);
    expect(auth.options.emailAndPassword).toEqual({ enabled: true });
  });

  it('does not configure a database itself', () => {
    expect(auth.options).not.toHaveProperty('database');
  });

  it('exposes the better-auth error codes', () => {
    expect(auth.$ERROR_CODES).toHaveProperty('USER_NOT_FOUND');
  });
});

describe('createAuthMiddleware', () => {
  it('is better-auth`s middleware factory', () => {
    expect(createAuthMiddleware).toBe(betterAuthCreateAuthMiddleware);
  });
});

describe('AuthError', () => {
  it('is better-auth`s APIError', () => {
    expect(AuthError).toBe(APIError);
  });

  it('carries the status and body it was built with', () => {
    const error = new AuthError('BAD_REQUEST', { message: 'Invalid credentials' });

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(APIError);
    expect(error.statusCode).toBe(400);
    expect(error.body?.message).toBe('Invalid credentials');
  });
});
