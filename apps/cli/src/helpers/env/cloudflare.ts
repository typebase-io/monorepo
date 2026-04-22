import { getCloudflareToken } from '#helpers/deploy/cloudflare/get-cloudflare-token.ts';
import { getCloudflareWorker } from '#helpers/deploy/cloudflare/get-cloudflare-worker.ts';

export const getCloudflareEnvVar = async ({ key, target }: { key: string; target: 'dev' | 'prod' }): Promise<string | undefined> => {
  const token = await getCloudflareToken();
  const worker = await getCloudflareWorker(token);
  const scriptName = target === 'dev' ? `${worker.workerName}-preview` : worker.workerName;

  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${worker.accountId}/workers/scripts/${scriptName}/secrets/${key}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 404) {
    return undefined;
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to fetch Cloudflare secret: ${body}`);
  }

  return 'ENCRYPTED';
};

export const addCloudflareEnvVar = async ({ key, value, target }: { key: string; value: string; target: 'dev' | 'prod' }): Promise<void> => {
  const token = await getCloudflareToken();
  const worker = await getCloudflareWorker(token);
  const scriptName = target === 'dev' ? `${worker.workerName}-preview` : worker.workerName;

  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${worker.accountId}/workers/scripts/${scriptName}/secrets`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: key, text: value, type: 'secret_text' }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to set Cloudflare secret: ${body}`);
  }
};
