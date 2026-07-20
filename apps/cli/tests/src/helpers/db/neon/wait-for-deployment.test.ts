import { type Operation, OperationStatus } from '@neondatabase/api-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { waitForDeployment } from '#helpers/db/neon/wait-for-deployment.ts';

const createApiClient = () => ({ getProjectOperation: vi.fn() });

const operation = ({ id, status, action = 'create_branch' }: { id: string; status: OperationStatus; action?: string }) =>
  ({
    id,
    status,
    action,
  }) as Operation;

const operationResponse = ({ status, error }: { status: OperationStatus; error?: string }) => ({
  data: {
    operation: {
      status,
      error,
    },
  },
});

describe('waitForDeployment', () => {
  let apiClient: ReturnType<typeof createApiClient>;

  beforeEach(() => {
    apiClient = createApiClient();

    vi.clearAllMocks();

    vi.spyOn(global, 'setTimeout').mockImplementation(((callback: () => void) => {
      callback();

      return undefined;
    }) as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('skips operations that are already finished or skipped', async () => {
    await waitForDeployment({
      apiClient: apiClient as never,
      projectId: 'project-1',
      operations: [
        operation({ id: 'op-finished', action: 'create_branch', status: OperationStatus.Finished }),
        operation({ id: 'op-skipped', status: OperationStatus.Skipped }),
      ],
    });

    expect(apiClient.getProjectOperation).not.toHaveBeenCalled();
    expect(setTimeout).not.toHaveBeenCalled();
  });

  it('polls pending operations until they finish', async () => {
    apiClient.getProjectOperation
      .mockResolvedValueOnce(operationResponse({ status: OperationStatus.Running }))
      .mockResolvedValueOnce(operationResponse({ status: OperationStatus.Finished }));

    await waitForDeployment({
      apiClient: apiClient as never,
      projectId: 'project-1',
      operations: [operation({ id: 'op-1', status: OperationStatus.Scheduling })],
    });

    expect(apiClient.getProjectOperation).toHaveBeenNthCalledWith(1, 'project-1', 'op-1');
    expect(apiClient.getProjectOperation).toHaveBeenNthCalledWith(2, 'project-1', 'op-1');
    expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 1000);
  });

  it('treats skipped pending operations as complete', async () => {
    apiClient.getProjectOperation.mockResolvedValueOnce(operationResponse({ status: OperationStatus.Skipped }));

    await expect(
      waitForDeployment({
        apiClient: apiClient as never,
        projectId: 'project-1',
        operations: [operation({ id: 'op-1', status: OperationStatus.Scheduling })],
      })
    ).resolves.toBeUndefined();

    expect(apiClient.getProjectOperation).toHaveBeenCalledOnce();
    expect(setTimeout).not.toHaveBeenCalled();
  });

  it('waits for each pending operation in order', async () => {
    apiClient.getProjectOperation
      .mockResolvedValueOnce(operationResponse({ status: OperationStatus.Finished }))
      .mockResolvedValueOnce(operationResponse({ status: OperationStatus.Finished }));

    await waitForDeployment({
      apiClient: apiClient as never,
      projectId: 'project-1',
      operations: [operation({ id: 'op-1', status: OperationStatus.Scheduling }), operation({ id: 'op-2', status: OperationStatus.Running })],
    });

    expect(apiClient.getProjectOperation).toHaveBeenNthCalledWith(1, 'project-1', 'op-1');
    expect(apiClient.getProjectOperation).toHaveBeenNthCalledWith(2, 'project-1', 'op-2');
  });

  it('throws failed operations with the Neon error message', async () => {
    apiClient.getProjectOperation.mockResolvedValueOnce(operationResponse({ status: OperationStatus.Failed, error: 'branch failed' }));

    await expect(
      waitForDeployment({
        apiClient: apiClient as never,
        projectId: 'project-1',
        operations: [operation({ id: 'op-1', status: OperationStatus.Scheduling, action: 'create_branch' })],
      })
    ).rejects.toThrow('Operation "create_branch" failed: branch failed');

    expect(setTimeout).not.toHaveBeenCalled();
  });

  it('throws errored operations with an unknown error fallback', async () => {
    apiClient.getProjectOperation.mockResolvedValueOnce(operationResponse({ status: OperationStatus.Error }));

    await expect(
      waitForDeployment({
        apiClient: apiClient as never,
        projectId: 'project-1',
        operations: [operation({ id: 'op-1', status: OperationStatus.Scheduling, action: 'create_project' })],
      })
    ).rejects.toThrow('Operation "create_project" failed: unknown error');
  });

  it('throws cancelled operations', async () => {
    apiClient.getProjectOperation.mockResolvedValueOnce(operationResponse({ status: OperationStatus.Cancelled, error: 'cancelled by user' }));

    await expect(
      waitForDeployment({
        apiClient: apiClient as never,
        projectId: 'project-1',
        operations: [operation({ id: 'op-1', status: OperationStatus.Running, action: 'create_endpoint' })],
      })
    ).rejects.toThrow('Operation "create_endpoint" failed: cancelled by user');
  });

  it('propagates Neon operation lookup errors', async () => {
    apiClient.getProjectOperation.mockRejectedValueOnce(new Error('lookup failed'));

    await expect(
      waitForDeployment({
        apiClient: apiClient as never,
        projectId: 'project-1',
        operations: [operation({ id: 'op-1', status: OperationStatus.Running })],
      })
    ).rejects.toThrow('lookup failed');
  });
});
