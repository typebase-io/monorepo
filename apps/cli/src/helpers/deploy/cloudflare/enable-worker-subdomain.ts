export const enableWorkerSubdomain = async ({ token, accountId, workerName }: { token: string; accountId: string; workerName: string }) => {
  await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${workerName}/subdomain`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ enabled: true }),
  });
};
