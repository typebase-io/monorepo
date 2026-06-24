import { createApiClient } from '@neondatabase/api-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getNeonBranch } from '#helpers/db/neon/get-neon-branch.ts';
import { getNeonConnectionUri } from '#helpers/db/neon/get-neon-connection-uri.ts';
import { getNeonProject } from '#helpers/db/neon/get-neon-project.ts';
import { getNeonToken } from '#helpers/db/neon/get-neon-token.ts';
import { neon } from '#helpers/db/neon/index.ts';

const apiClient = vi.hoisted(() => ({ marker: 'api-client' }));

vi.mock('@neondatabase/api-client', () => ({ createApiClient: vi.fn(() => apiClient) }));
vi.mock('#helpers/db/neon/get-neon-branch.ts', () => ({ getNeonBranch: vi.fn() }));
vi.mock('#helpers/db/neon/get-neon-connection-uri.ts', () => ({ getNeonConnectionUri: vi.fn() }));
vi.mock('#helpers/db/neon/get-neon-project.ts', () => ({ getNeonProject: vi.fn() }));
vi.mock('#helpers/db/neon/get-neon-token.ts', () => ({ getNeonToken: vi.fn() }));

describe('neon', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getNeonToken).mockResolvedValue('neon-token');
    vi.mocked(getNeonProject).mockResolvedValue({ orgId: 'org-1', projectId: 'project-1' });
    vi.mocked(getNeonBranch).mockResolvedValue('branch-1');
    vi.mocked(getNeonConnectionUri).mockResolvedValue('postgres://connection');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves the Neon project, branch, and connection URI for the target', async () => {
    const result = await neon({ target: 'dev' });

    expect(result).toEqual({
      projectId: 'project-1',
      branchId: 'branch-1',
      connectionUri: 'postgres://connection',
    });

    expect(getNeonToken).toHaveBeenCalledOnce();
    expect(getNeonProject).toHaveBeenCalledWith('neon-token');
    expect(createApiClient).toHaveBeenCalledWith({ apiKey: 'neon-token' });
    expect(getNeonBranch).toHaveBeenCalledWith({ apiClient, projectId: 'project-1', target: 'dev' });

    expect(getNeonConnectionUri).toHaveBeenCalledWith({
      token: 'neon-token',
      projectId: 'project-1',
      branchId: 'branch-1',
      target: 'dev',
    });

    expect(getNeonToken).toHaveBeenCalledBefore(vi.mocked(getNeonProject));
    expect(getNeonProject).toHaveBeenCalledBefore(vi.mocked(createApiClient));
    expect(createApiClient).toHaveBeenCalledBefore(vi.mocked(getNeonBranch));
    expect(getNeonBranch).toHaveBeenCalledBefore(vi.mocked(getNeonConnectionUri));
  });

  it('passes the production target through branch and connection lookup', async () => {
    await neon({ target: 'prod' });

    expect(getNeonBranch).toHaveBeenCalledWith({ apiClient, projectId: 'project-1', target: 'prod' });
    expect(getNeonConnectionUri).toHaveBeenCalledWith({
      token: 'neon-token',
      projectId: 'project-1',
      branchId: 'branch-1',
      target: 'prod',
    });
  });

  it('stops when token resolution fails', async () => {
    vi.mocked(getNeonToken).mockRejectedValue(new Error('token failed'));

    await expect(neon({ target: 'dev' })).rejects.toThrow('token failed');

    expect(getNeonProject).not.toHaveBeenCalled();
    expect(createApiClient).not.toHaveBeenCalled();
    expect(getNeonBranch).not.toHaveBeenCalled();
    expect(getNeonConnectionUri).not.toHaveBeenCalled();
  });

  it('stops when project resolution fails', async () => {
    vi.mocked(getNeonProject).mockRejectedValue(new Error('project failed'));

    await expect(neon({ target: 'dev' })).rejects.toThrow('project failed');

    expect(createApiClient).not.toHaveBeenCalled();
    expect(getNeonBranch).not.toHaveBeenCalled();
    expect(getNeonConnectionUri).not.toHaveBeenCalled();
  });

  it('stops when branch resolution fails', async () => {
    vi.mocked(getNeonBranch).mockRejectedValue(new Error('branch failed'));

    await expect(neon({ target: 'prod' })).rejects.toThrow('branch failed');

    expect(getNeonConnectionUri).not.toHaveBeenCalled();
  });

  it('propagates connection URI failures', async () => {
    vi.mocked(getNeonConnectionUri).mockRejectedValue(new Error('uri failed'));

    await expect(neon({ target: 'prod' })).rejects.toThrow('uri failed');

    expect(getNeonBranch).toHaveBeenCalledOnce();
    expect(getNeonConnectionUri).toHaveBeenCalledOnce();
  });
});
