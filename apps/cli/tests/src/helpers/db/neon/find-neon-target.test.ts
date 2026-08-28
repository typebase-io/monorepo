import { createApiClient } from '@neondatabase/api-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { findNeonTarget } from '#helpers/db/neon/find-neon-target.ts';
import { getNeonConnectionUri } from '#helpers/db/neon/get-neon-connection-uri.ts';
import { getNeonToken } from '#helpers/db/neon/get-neon-token.ts';
import { getTypebaseConfig } from '#helpers/shared/get-typebase-config.ts';

const apiMocks = vi.hoisted(() => ({ listProjectBranches: vi.fn() }));

vi.mock('@neondatabase/api-client', () => ({ createApiClient: vi.fn(() => ({ listProjectBranches: apiMocks.listProjectBranches })) }));
vi.mock('#helpers/db/neon/get-neon-token.ts', () => ({ getNeonToken: vi.fn() }));
vi.mock('#helpers/db/neon/get-neon-connection-uri.ts', () => ({ getNeonConnectionUri: vi.fn() }));
vi.mock('#helpers/shared/get-typebase-config.ts', () => ({ getTypebaseConfig: vi.fn() }));

const branches = (...found: { id: string; name: string; default?: boolean }[]) => Promise.resolve({ data: { branches: found } });

describe('findNeonTarget', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(getTypebaseConfig).mockResolvedValue({ projectPath: 'typebase', neon: { orgId: 'org-1', projectId: 'proj-1' } } as never);
    vi.mocked(getNeonToken).mockResolvedValue('neon-token');
    vi.mocked(getNeonConnectionUri).mockResolvedValue('postgres://neon/db');

    apiMocks.listProjectBranches.mockReturnValue(branches({ id: 'br-main', name: 'main', default: true }, { id: 'br-dev', name: 'dev' }));
  });

  it('returns the connection string for an existing prod branch', async () => {
    expect(await findNeonTarget({ target: 'prod' })).toEqual({ connectionUri: 'postgres://neon/db' });

    expect(getNeonConnectionUri).toHaveBeenCalledWith(expect.objectContaining({ branchId: 'br-main', target: 'prod' }));
  });

  it('returns the connection string for an existing dev branch', async () => {
    expect(await findNeonTarget({ target: 'dev' })).toEqual({ connectionUri: 'postgres://neon/db' });

    expect(getNeonConnectionUri).toHaveBeenCalledWith(expect.objectContaining({ branchId: 'br-dev', target: 'dev' }));
  });

  it('creates nothing when the project has no dev branch yet', async () => {
    apiMocks.listProjectBranches.mockReturnValue(branches({ id: 'br-main', name: 'main', default: true }));

    expect(await findNeonTarget({ target: 'dev' })).toBeUndefined();
    expect(getNeonConnectionUri).not.toHaveBeenCalled();
  });

  it('creates nothing when the project has no default branch', async () => {
    apiMocks.listProjectBranches.mockReturnValue(branches({ id: 'br-dev', name: 'dev' }));

    expect(await findNeonTarget({ target: 'prod' })).toBeUndefined();
  });

  it('never contacts neon at all when no project is recorded', async () => {
    vi.mocked(getTypebaseConfig).mockResolvedValue({ projectPath: 'typebase' } as never);

    expect(await findNeonTarget({ target: 'prod' })).toBeUndefined();

    expect(getNeonToken).not.toHaveBeenCalled();
    expect(createApiClient).not.toHaveBeenCalled();
  });

  it('treats an unreachable project as having no database rather than failing', async () => {
    apiMocks.listProjectBranches.mockReturnValue(Promise.reject(new Error('project not found')));

    expect(await findNeonTarget({ target: 'prod' })).toBeUndefined();
  });
});
