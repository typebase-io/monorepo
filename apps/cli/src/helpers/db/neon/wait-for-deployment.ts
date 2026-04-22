import { type Operation, OperationStatus, type createApiClient } from '@neondatabase/api-client';

export const waitForDeployment = async ({
  apiClient,
  projectId,
  operations,
}: {
  apiClient: ReturnType<typeof createApiClient>;
  projectId: string;
  operations: Operation[];
}) => {
  const pending = operations.filter((op) => op.status !== OperationStatus.Finished && op.status !== OperationStatus.Skipped);

  for (const op of pending) {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    while (true) {
      const opRes = await apiClient.getProjectOperation(projectId, op.id);
      const { status, error } = opRes.data.operation;

      if (status === OperationStatus.Finished || status === OperationStatus.Skipped) {
        break;
      }

      if (status === OperationStatus.Failed || status === OperationStatus.Error || status === OperationStatus.Cancelled) {
        throw new Error(`Operation "${op.action}" failed: ${error ?? 'unknown error'}`);
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
};
