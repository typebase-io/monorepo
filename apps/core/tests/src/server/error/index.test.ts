import { ORPCError } from '@orpc/server';
import { describe, expect, it } from 'vitest';

import { ServerError } from '#server/error/index.ts';

describe('ServerError', () => {
  it('is oRPC`s error class', () => {
    expect(ServerError).toBe(ORPCError);
  });

  it('carries the code, status and data it was built with', () => {
    const error = new ServerError('NOT_FOUND', { message: 'Todo not found', data: { id: 1 } });

    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe('NOT_FOUND');
    expect(error.status).toBe(404);
    expect(error.message).toBe('Todo not found');
    expect(error.data).toEqual({ id: 1 });
  });

  it('derives a default status from the code', () => {
    expect(new ServerError('UNAUTHORIZED').status).toBe(401);
    expect(new ServerError('FORBIDDEN').status).toBe(403);
    expect(new ServerError('CONFLICT').status).toBe(409);
    expect(new ServerError('INTERNAL_SERVER_ERROR').status).toBe(500);
  });
});
