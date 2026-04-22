import { VercelClient } from '#helpers/deploy/vercel/client.ts';
import { getVercelProject } from '#helpers/deploy/vercel/get-vercel-project.ts';
import { getVercelToken } from '#helpers/deploy/vercel/get-vercel-token.ts';

export const getVercelEnvVar = async ({ key, target }: { key: string; target: 'dev' | 'prod' }): Promise<string | undefined> => {
  const token = await getVercelToken();
  const project = await getVercelProject(token);
  const vercel = new VercelClient({ token, orgId: project.orgId });

  const env = await vercel.getEnvVariable({
    projectId: project.projectId,
    key,
    target,
  });

  return env?.value;
};

export const addVercelEnvVar = async ({
  key,
  value,
  encrypted,
  target,
}: {
  key: string;
  value: string;
  encrypted: boolean;
  target: 'dev' | 'prod';
}): Promise<void> => {
  const token = await getVercelToken();
  const project = await getVercelProject(token);
  const vercel = new VercelClient({ token, orgId: project.orgId });

  await vercel.addEnvVariable({
    projectId: project.projectId,
    key,
    value,
    encrypted,
    target,
  });
};
