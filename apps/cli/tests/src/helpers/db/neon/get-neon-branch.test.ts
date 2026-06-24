import { EndpointType } from '@neondatabase/api-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getNeonBranch } from '#helpers/db/neon/get-neon-branch.ts';
import { waitForDeployment } from '#helpers/db/neon/wait-for-deployment.ts';

vi.mock('#helpers/db/neon/wait-for-deployment.ts', () => ({ waitForDeployment: vi.fn() }));

const createApiClient = () => ({
  createProjectBranch: vi.fn(),
  listProjectBranches: vi.fn(),
});

describe('getNeonBranch', () => {
  let apiClient: ReturnType<typeof createApiClient>;

  beforeEach(() => {
    apiClient = createApiClient();

    vi.clearAllMocks();
    vi.mocked(waitForDeployment).mockResolvedValue(undefined);

    apiClient.listProjectBranches.mockResolvedValue({
      data: {
        branches: [
          { id: 'br-main', name: 'main', default: true },
          { id: 'br-dev', name: 'dev', default: false },
        ],
      },
    });

    apiClient.createProjectBranch.mockResolvedValue({
      data: {
        branch: { id: 'br-new-dev' },
        operations: [{ id: 'op-1' }],
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the default branch for production', async () => {
    await expect(getNeonBranch({ apiClient: apiClient as never, projectId: 'project-1', target: 'prod' })).resolves.toBe('br-main');

    expect(apiClient.listProjectBranches).toHaveBeenCalledWith({ projectId: 'project-1' });
    expect(apiClient.createProjectBranch).not.toHaveBeenCalled();
    expect(waitForDeployment).not.toHaveBeenCalled();
  });

  it('returns the existing dev branch for development', async () => {
    await expect(getNeonBranch({ apiClient: apiClient as never, projectId: 'project-1', target: 'dev' })).resolves.toBe('br-dev');

    expect(apiClient.createProjectBranch).not.toHaveBeenCalled();
  });

  it('creates a dev branch from the default branch when one does not exist', async () => {
    const operations = [{ id: 'op-1' }];

    apiClient.listProjectBranches.mockResolvedValue({
      data: {
        branches: [{ id: 'br-main', name: 'main', default: true }],
      },
    });

    apiClient.createProjectBranch.mockResolvedValue({
      data: {
        branch: { id: 'br-new-dev' },
        operations,
      },
    });

    await expect(getNeonBranch({ apiClient: apiClient as never, projectId: 'project-1', target: 'dev' })).resolves.toBe('br-new-dev');

    expect(apiClient.createProjectBranch).toHaveBeenCalledWith('project-1', {
      branch: { name: 'dev', parent_id: 'br-main', init_source: 'schema-only' },
      endpoints: [{ type: EndpointType.ReadWrite }],
    });

    expect(waitForDeployment).toHaveBeenCalledWith({ apiClient, projectId: 'project-1', operations });
  });

  it('throws when production has no default branch', async () => {
    apiClient.listProjectBranches.mockResolvedValue({
      data: {
        branches: [{ id: 'br-other', name: 'other', default: false }],
      },
    });

    await expect(getNeonBranch({ apiClient: apiClient as never, projectId: 'project-1', target: 'prod' })).rejects.toThrow(
      'No default branch found for this Neon project.'
    );

    expect(apiClient.createProjectBranch).not.toHaveBeenCalled();
  });

  it('throws when development has no dev branch and no default branch to fork from', async () => {
    apiClient.listProjectBranches.mockResolvedValue({
      data: {
        branches: [{ id: 'br-other', name: 'other', default: false }],
      },
    });

    await expect(getNeonBranch({ apiClient: apiClient as never, projectId: 'project-1', target: 'dev' })).rejects.toThrow(
      'No default branch found for this Neon project.'
    );

    expect(apiClient.createProjectBranch).not.toHaveBeenCalled();
  });

  it('propagates errors while creating or waiting for the dev branch', async () => {
    apiClient.listProjectBranches.mockResolvedValue({
      data: {
        branches: [{ id: 'br-main', name: 'main', default: true }],
      },
    });

    vi.mocked(waitForDeployment).mockRejectedValue(new Error('operation failed'));

    await expect(getNeonBranch({ apiClient: apiClient as never, projectId: 'project-1', target: 'dev' })).rejects.toThrow('operation failed');
  });
});
