import { deploy } from '#helpers/deploy/cloudflare/deploy.ts';
import { enableWorkerSubdomain } from '#helpers/deploy/cloudflare/enable-worker-subdomain.ts';
import { getCloudflareToken } from '#helpers/deploy/cloudflare/get-cloudflare-token.ts';
import { getCloudflareWorker } from '#helpers/deploy/cloudflare/get-cloudflare-worker.ts';

export const cloudflare = async ({
  serverDirPath,
  target,
  env,
}: {
  serverDirPath: string;
  target: 'dev' | 'prod';
  env: { key: string; value: string; secret: boolean }[];
}) => {
  const token = await getCloudflareToken();
  const worker = await getCloudflareWorker(token);
  const scriptName = target === 'dev' ? `${worker.workerName}-preview` : worker.workerName;

  const deployment = await deploy({
    token,
    accountId: worker.accountId,
    workerName: scriptName,
    serverDirPath,
    env,
  });

  await enableWorkerSubdomain({ token, accountId: worker.accountId, workerName: scriptName });

  return {
    deploymentId: deployment.deploymentId,
    url: `https://${scriptName}.${worker.subdomain}.workers.dev`,
  };
};
