import { createApiClient } from '@neondatabase/api-client';

import { getNeonConnectionUri } from '#helpers/db/neon/get-neon-connection-uri.ts';
import { getNeonToken } from '#helpers/db/neon/get-neon-token.ts';
import { getTypebaseConfig } from '#helpers/shared/get-typebase-config.ts';

export const findNeonTarget = async ({ target }: { target: 'dev' | 'prod' }) => {
  const config = await getTypebaseConfig();

  if (!config.neon) {
    return undefined;
  }

  const token = await getNeonToken();
  const apiClient = createApiClient({ apiKey: token });

  const { projectId } = config.neon;

  const branches = await apiClient.listProjectBranches({ projectId }).then(
    (response) => response.data.branches,
    () => undefined
  );

  const branch = branches?.find((candidate) => (target === 'prod' ? candidate.default : candidate.name === 'dev'));

  if (!branch) {
    return undefined;
  }

  return {
    connectionUri: await getNeonConnectionUri({ token, projectId, branchId: branch.id, target }),
  };
};
