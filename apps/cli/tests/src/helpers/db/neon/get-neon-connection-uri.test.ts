import { createApiClient } from '@neondatabase/api-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getNeonConnectionUri } from '#helpers/db/neon/get-neon-connection-uri.ts';

import { type TempDir, createTempDir, withCwd } from '#tests/helpers/temp-dir.ts';

const apiMocks = vi.hoisted(() => ({ getConnectionUri: vi.fn() }));

vi.mock('@neondatabase/api-client', () => ({ createApiClient: vi.fn(() => apiMocks) }));

describe('getNeonConnectionUri', () => {
  let tmp: TempDir;

  beforeEach(() => {
    tmp = createTempDir();

    delete process.env.DATABASE_URL;
    delete process.env.DATABASE_URL_DEV;

    vi.clearAllMocks();

    apiMocks.getConnectionUri.mockResolvedValue({
      data: {
        uri: 'postgres://user:pass@host.neon.tech/neondb?connect_timeout=10',
      },
    });
  });

  afterEach(() => {
    tmp.cleanup();

    delete process.env.DATABASE_URL;
    delete process.env.DATABASE_URL_DEV;

    vi.restoreAllMocks();
  });

  it('returns the production URI from the environment without calling Neon', async () => {
    tmp.write('.env', 'DATABASE_URL=postgres://from-env\n');

    const uri = await withCwd(tmp.path, () =>
      getNeonConnectionUri({ token: 'neon-token', projectId: 'project-1', branchId: 'br-main', target: 'prod' })
    );

    expect(uri).toBe('postgres://from-env');
    expect(createApiClient).not.toHaveBeenCalled();
    expect(tmp.read('.env')).toBe('DATABASE_URL=postgres://from-env\n');
  });

  it('fetches a production URI, forces ssl verification, and saves it to .env', async () => {
    const uri = await withCwd(tmp.path, () =>
      getNeonConnectionUri({ token: 'neon-token', projectId: 'project-1', branchId: 'br-main', target: 'prod' })
    );

    expect(createApiClient).toHaveBeenCalledWith({ apiKey: 'neon-token' });

    expect(apiMocks.getConnectionUri).toHaveBeenCalledWith({
      projectId: 'project-1',
      branch_id: 'br-main',
      database_name: 'neondb',
      role_name: 'neondb_owner',
    });

    expect(uri).toBe('postgres://user:pass@host.neon.tech/neondb?connect_timeout=10&sslmode=verify-full');
    expect(tmp.read('.env')).toBe(`DATABASE_URL=${uri}\n`);
  });

  it('uses DATABASE_URL_DEV for development branches', async () => {
    apiMocks.getConnectionUri.mockResolvedValue({
      data: {
        uri: 'postgres://user:pass@host.neon.tech/neondb',
      },
    });

    const uri = await withCwd(tmp.path, () =>
      getNeonConnectionUri({ token: 'neon-token', projectId: 'project-1', branchId: 'br-dev', target: 'dev' })
    );

    expect(uri).toBe('postgres://user:pass@host.neon.tech/neondb?sslmode=verify-full');
    expect(tmp.read('.env')).toBe(`DATABASE_URL_DEV=${uri}\n`);
  });

  it('propagates Neon API errors without writing .env', async () => {
    apiMocks.getConnectionUri.mockRejectedValue(new Error('uri failed'));

    await expect(
      withCwd(tmp.path, () => getNeonConnectionUri({ token: 'neon-token', projectId: 'project-1', branchId: 'br-main', target: 'prod' }))
    ).rejects.toThrow('uri failed');

    expect(tmp.exists('.env')).toBe(false);
  });
});
