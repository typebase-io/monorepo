import chalk from 'chalk';

import { assignAlias } from '#helpers/deploy/vercel/assign-alias.ts';
import { VercelClient } from '#helpers/deploy/vercel/client.ts';
import { deployPlaceholder } from '#helpers/deploy/vercel/deploy-placeholder.ts';
import { deploy } from '#helpers/deploy/vercel/deploy.ts';
import { getVercelProject } from '#helpers/deploy/vercel/get-vercel-project.ts';
import { getVercelToken } from '#helpers/deploy/vercel/get-vercel-token.ts';
import { waitForDeployment } from '#helpers/deploy/vercel/wait-for-deployment.ts';

export const vercel = async ({
  serverDirPath,
  target,
  env,
}: {
  serverDirPath: string;
  target: 'dev' | 'prod';
  env: { key: string; value: string; secret: boolean }[];
}) => {
  const token = await getVercelToken();
  const project = await getVercelProject(token);
  const client = new VercelClient({ token, orgId: project.orgId });

  if (target === 'dev') {
    const hasAnyDeployment = await client.hasAnyDeployment({ projectId: project.projectId });

    if (!hasAnyDeployment) {
      console.log(
        chalk.yellow(
          'Warning: this is the first deployment for this Vercel project. Vercel auto-promotes the first deployment to production regardless of target. ' +
            "Seeding production with a placeholder deployment first so your dev deploy isn't promoted."
        )
      );

      await deployPlaceholder({ token, projectName: project.projectName, orgId: project.orgId });
    }
  }

  if (env.length > 0) {
    await Promise.all(
      env.map(({ key, value, secret }) => client.addEnvVariable({ projectId: project.projectId, key, value, encrypted: secret, target }))
    );
  }

  const deployment = await deploy({ token, projectName: project.projectName, orgId: project.orgId, serverDirPath, target });

  await waitForDeployment({ token, deploymentId: deployment.deploymentId, orgId: project.orgId, type: 'normal' });

  const alias = await assignAlias({ token, deploymentId: deployment.deploymentId, projectId: project.projectId, orgId: project.orgId, target });

  return {
    deploymentId: deployment.deploymentId,
    url: `https://${alias}`,
  };
};
