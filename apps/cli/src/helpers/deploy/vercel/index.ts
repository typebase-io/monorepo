import { assignAlias } from '#helpers/deploy/vercel/assign-alias.ts';
import { VercelClient } from '#helpers/deploy/vercel/client.ts';
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

  if (env.length > 0) {
    const client = new VercelClient({ token, orgId: project.orgId });

    await Promise.all(
      env.map(({ key, value, secret }) => client.addEnvVariable({ projectId: project.projectId, key, value, encrypted: secret, target }))
    );
  }

  const deployment = await deploy({ token, projectName: project.projectName, orgId: project.orgId, serverDirPath, target });

  await waitForDeployment({ token, deploymentId: deployment.deploymentId, orgId: project.orgId });

  const alias = await assignAlias({ token, deploymentId: deployment.deploymentId, projectId: project.projectId, orgId: project.orgId, target });

  return {
    deploymentId: deployment.deploymentId,
    url: `https://${alias}`,
  };
};
