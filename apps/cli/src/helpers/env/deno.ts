import { getDenoProject } from '#helpers/deploy/deno/get-deno-project.ts';
import { getDenoToken } from '#helpers/deploy/deno/get-deno-token.ts';

export const getDenoEnvVar = async ({ key, target }: { key: string; target: 'dev' | 'prod' }): Promise<string | undefined> => {
  const token = await getDenoToken();
  const project = await getDenoProject(token);

  const res = await fetch(`https://api.deno.com/v2/apps/${project.projectId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to fetch Deno Deploy app: ${body}`);
  }

  const app = (await res.json()) as { env_vars?: { key: string; value?: string; contexts: string | string[] }[] };

  const env = app.env_vars?.find((e) => {
    if (e.key !== key) {
      return false;
    }

    const eContexts = Array.isArray(e.contexts) ? e.contexts : [e.contexts];

    return eContexts.includes(target === 'dev' ? 'preview' : 'production');
  });

  if (!env) {
    return undefined;
  }

  return env.value ?? 'ENCRYPTED';
};

export const addDenoEnvVar = async ({
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
  const token = await getDenoToken();
  const project = await getDenoProject(token);

  const res = await fetch(`https://api.deno.com/v2/apps/${project.projectId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ env_vars: [{ key, value, secret: encrypted, contexts: [target === 'dev' ? 'preview' : 'production'] }] }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to set Deno Deploy env var: ${body}`);
  }
};
