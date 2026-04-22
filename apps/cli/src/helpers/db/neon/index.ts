import { createApiClient } from '@neondatabase/api-client';

import { getNeonBranch } from '#helpers/db/neon/get-neon-branch.ts';
import { getNeonConnectionUri } from '#helpers/db/neon/get-neon-connection-uri.ts';
import { getNeonProject } from '#helpers/db/neon/get-neon-project.ts';
import { getNeonToken } from '#helpers/db/neon/get-neon-token.ts';

export const neon = async ({ target }: { target: 'dev' | 'prod' }) => {
  const token = await getNeonToken();
  const project = await getNeonProject(token);
  const apiClient = createApiClient({ apiKey: token });
  const branchId = await getNeonBranch({ apiClient, projectId: project.projectId, target });
  const connectionUri = await getNeonConnectionUri({ token, projectId: project.projectId, branchId, target });

  return {
    projectId: project.projectId,
    branchId,
    connectionUri,
  };
};
