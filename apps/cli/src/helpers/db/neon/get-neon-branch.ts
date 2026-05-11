import { EndpointType, type createApiClient } from '@neondatabase/api-client';
import ora from 'ora';

import { waitForDeployment } from '#helpers/db/neon/wait-for-deployment.ts';

export const getNeonBranch = async ({
  apiClient,
  projectId,
  target,
}: {
  apiClient: ReturnType<typeof createApiClient>;
  projectId: string;
  target: 'dev' | 'prod';
}): Promise<string> => {
  const spinner = ora('Fetching Neon branches...').start();

  const branchesRes = await apiClient.listProjectBranches({ projectId });
  const branches = branchesRes.data.branches;
  const mainBranch = branches.find((b) => b.default);
  const devBranch = branches.find((b) => b.name === 'dev');

  spinner.stop();

  if (target === 'prod') {
    if (!mainBranch) {
      throw new Error('No default branch found for this Neon project.');
    }

    return mainBranch.id;
  }

  if (devBranch) {
    return devBranch.id;
  }

  if (!mainBranch) {
    throw new Error('No default branch found for this Neon project.');
  }

  const createSpinner = ora('Creating "dev" branch on Neon...').start();

  const createRes = await apiClient.createProjectBranch(projectId, {
    branch: { name: 'dev', parent_id: mainBranch.id },
    endpoints: [{ type: EndpointType.ReadWrite }],
  });

  await waitForDeployment({ apiClient, projectId, operations: createRes.data.operations });

  createSpinner.succeed('Branch "dev" created on Neon.');

  return createRes.data.branch.id;
};
