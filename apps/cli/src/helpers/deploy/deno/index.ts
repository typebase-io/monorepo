import { deploy } from '#helpers/deploy/deno/deploy.ts';
import { getDenoProject } from '#helpers/deploy/deno/get-deno-project.ts';
import { getDenoToken } from '#helpers/deploy/deno/get-deno-token.ts';
import { waitForDeployment } from '#helpers/deploy/deno/wait-for-deployment.ts';

export const deno = async ({
  serverDirPath,
  target,
  env,
}: {
  serverDirPath: string;
  target: 'dev' | 'prod';
  env: { key: string; value: string; secret: boolean }[];
}) => {
  const token = await getDenoToken();
  const project = await getDenoProject(token);

  if (env.length > 0) {
    const res = await fetch(`https://api.deno.com/v2/apps/${project.projectId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        env_vars: env.map(({ key, value, secret }) => ({
          key,
          value,
          secret,
          contexts: [target === 'dev' ? 'preview' : 'production'],
        })),
      }),
    });

    if (!res.ok) {
      const body = await res.text();

      throw new Error(`Failed to set Deno Deploy env vars: ${body}`);
    }
  }

  const deployment = await deploy({ token, projectId: project.projectId, serverDirPath, target });

  await waitForDeployment({ token, revisionId: deployment.revisionId });

  return {
    deploymentId: deployment.revisionId,
    url:
      target === 'prod'
        ? `https://${project.slug}.${project.org}.deno.net`
        : `https://${project.slug}-${deployment.revisionId}.${project.org}.deno.net`,
  };
};
