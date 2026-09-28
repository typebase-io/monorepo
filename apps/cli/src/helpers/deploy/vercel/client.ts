import fs from 'node:fs/promises';

import { type BucketAccess } from '#helpers/constants.ts';

export class VercelClient {
  #token: string;
  #orgId: string | undefined;

  public constructor({ token, orgId }: { token: string; orgId: string | undefined }) {
    this.#token = token;
    this.#orgId = orgId;
  }

  public async assignAlias({ deploymentId, alias }: { deploymentId: string; alias: string }): Promise<void> {
    const response = await fetch(`https://api.vercel.com/v2/deployments/${deploymentId}/aliases${this.query}`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        alias,
      }),
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }
  }

  public async hasAnyDeployment({ projectId }: { projectId: string }): Promise<boolean> {
    const params = new URLSearchParams({ projectId, limit: '1' });

    if (this.#orgId) {
      params.set('teamId', this.#orgId);
    }

    const response = await fetch(`https://api.vercel.com/v6/deployments?${params}`, {
      method: 'GET',
      headers: this.headers,
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const data = (await response.json()) as { deployments: unknown[] };

    return data.deployments.length > 0;
  }

  public async getDeployment({ idOrUrl }: { idOrUrl: string }): Promise<{ id: string; readyState: string } | undefined> {
    const response = await fetch(`https://api.vercel.com/v13/deployments/${idOrUrl}${this.query}`, {
      method: 'GET',
      headers: this.headers,
    });

    if (response.status === 404) {
      return undefined;
    }

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const data = (await response.json()) as { id: string; readyState: string };

    return { id: data.id, readyState: data.readyState };
  }

  public async getRequestLogs({
    projectId,
    deploymentId,
    startDate,
    endDate,
    signal,
  }: {
    projectId: string;
    deploymentId: string;
    startDate: number;
    endDate: number;
    signal: AbortSignal;
  }): Promise<
    {
      requestId?: string;
      timestamp?: string | number;
      requestMethod?: string;
      requestPath?: string;
      statusCode?: number;
      logs?: { level?: string; message?: string }[];
    }[]
  > {
    const params = new URLSearchParams({
      projectId,
      deploymentId,
      page: '0',
      startDate: String(startDate),
      endDate: String(endDate),
    });

    if (this.#orgId) {
      params.set('ownerId', this.#orgId);
    }

    const response = await fetch(`https://vercel.com/api/logs/request-logs?${params}`, {
      method: 'GET',
      headers: this.headers,
      signal,
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const data = (await response.json()) as {
      rows?: {
        requestId?: string;
        timestamp?: string | number;
        requestMethod?: string;
        requestPath?: string;
        statusCode?: number;
        logs?: { level?: string; message?: string }[];
      }[];
    };

    return data.rows ?? [];
  }

  public async getDeploymentState({ deploymentId }: { deploymentId: string }): Promise<string> {
    const response = await fetch(`https://api.vercel.com/v13/deployments/${deploymentId}${this.query}`, {
      method: 'GET',
      headers: this.headers,
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const data = (await response.json()) as { readyState: string };

    return data.readyState;
  }

  public async getProjects(): Promise<
    {
      id: string;
      name: string;
      accountId: string;
      ssoProtection?: unknown;
      passwordProtection?: string;
    }[]
  > {
    const allProjects: { id: string; name: string; accountId: string; ssoProtection?: unknown; passwordProtection?: string }[] = [];
    let from: string | undefined;

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    while (true) {
      const params = new URLSearchParams({ limit: '100' });

      if (this.#orgId) {
        params.set('teamId', this.#orgId);
      }

      if (from) {
        params.set('from', from);
      }

      const response = await fetch(`https://api.vercel.com/v10/projects?${params}`, {
        method: 'GET',
        headers: this.headers,
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const data = (await response.json()) as {
        projects: {
          id: string;
          name: string;
          accountId: string;
          ssoProtection?: unknown;
          passwordProtection?: string;
        }[];
        pagination?: { next?: number };
      };

      if (Array.isArray(data)) {
        throw new Error('Failed to fetch projects.');
      }

      allProjects.push(
        ...data.projects.map(({ id, name, accountId, ssoProtection, passwordProtection }) => ({
          id,
          name,
          accountId,
          ssoProtection,
          passwordProtection,
        }))
      );

      const next = data.pagination?.next;

      if (!next || data.projects.length === 0) {
        break;
      }

      from = String(next);
    }

    return allProjects;
  }

  public async createProject({ name, framework }: { name: string; framework: string }): Promise<{ id: string; name: string; accountId: string }> {
    const response = await fetch(`https://api.vercel.com/v11/projects${this.query}`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        name,
        framework,
      }),
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const data = (await response.json()) as { id: string; name: string; accountId: string };

    return data;
  }

  public async removeProtectionsToProject({ id }: { id: string }): Promise<void> {
    const response = await fetch(`https://api.vercel.com/v9/projects/${id}${this.query}`, {
      method: 'PATCH',
      headers: this.headers,
      body: JSON.stringify({
        ssoProtection: null,
        passwordProtection: null,
      }),
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }
  }

  public async createDeployment({
    name,
    target,
    files,
    projectSettings,
  }: {
    name: string;
    target: 'dev' | 'prod';
    files: { file: string; sha: string; size: number }[];
    projectSettings: { installCommand: string; framework: string | null };
  }): Promise<{ status: 'ok'; id: string; url: string } | { status: 'missing_files'; missing: string[] }> {
    const response = await fetch(`https://api.vercel.com/v13/deployments${this.query}`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        name,
        target: target === 'dev' ? 'staging' : 'production',
        files,
        projectSettings,
      }),
    });

    if (response.ok) {
      const data = (await response.json()) as { id: string; url: string };

      return { status: 'ok', id: data.id, url: data.url };
    }

    const text = await response.text();

    if (response.status === 400) {
      try {
        const body = JSON.parse(text) as { error?: { code?: string; missing?: string[] } };

        if (body.error?.code === 'missing_files' && Array.isArray(body.error.missing)) {
          return { status: 'missing_files', missing: body.error.missing };
        }
      } catch {
        // not JSON, fall through to throw
      }
    }

    throw new Error(text || `Deployment failed with status ${response.status}`);
  }

  public async uploadFiles({ files }: { files: { sha: string; size: number; absPath: string }[] }): Promise<void> {
    const concurrentUploads = 50;
    const maxRetries = 5;
    const queue = [...files];

    await Promise.all(
      Array.from({ length: Math.min(concurrentUploads, files.length) }, async () => {
        let ref;

        while ((ref = queue.shift())) {
          let attempt = 0;

          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          while (true) {
            try {
              const content = await fs.readFile(ref.absPath);

              const response = await fetch(`https://api.vercel.com/v2/files${this.query}`, {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${this.#token}`,
                  'Content-Type': 'application/octet-stream',
                  'x-vercel-digest': ref.sha,
                  'Content-Length': String(ref.size),
                },
                body: content,
              });

              if (!response.ok) {
                throw new Error(await response.text());
              }

              break;
            } catch (err) {
              attempt++;

              if (attempt >= maxRetries) {
                throw err;
              }

              await new Promise((r) => setTimeout(r, 10 * Math.pow(6, attempt)));
            }
          }
        }
      })
    );
  }

  public async getEnvVariable({
    projectId,
    key,
    target,
  }: {
    projectId: string;
    key: string;
    target: 'dev' | 'prod';
  }): Promise<{ key: string; target: string | string[]; value?: string } | undefined> {
    const params = new URLSearchParams({ decrypt: 'true' });

    if (this.#orgId) {
      params.set('teamId', this.#orgId);
    }

    const response = await fetch(`https://api.vercel.com/v10/projects/${projectId}/env?${params}`, {
      method: 'GET',
      headers: this.headers,
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const data = (await response.json()) as { envs: { key: string; target: string | string[]; value?: string }[] };

    const env = data.envs.find((e) => {
      if (e.key !== key) {
        return false;
      }

      const eTarget = Array.isArray(e.target) ? e.target : [e.target];

      if (target === 'dev') {
        return eTarget.includes('development') || eTarget.includes('preview');
      }

      return eTarget.includes('production');
    });

    return env;
  }

  public async addEnvVariable({
    projectId,
    key,
    value,
    encrypted,
    target,
  }: {
    projectId: string;
    key: string;
    value: string;
    encrypted: boolean;
    target: 'dev' | 'prod';
  }): Promise<void> {
    const params = new URLSearchParams({ upsert: 'true' });

    if (this.#orgId) {
      params.set('teamId', this.#orgId);
    }

    const response = await fetch(`https://api.vercel.com/v10/projects/${projectId}/env?${params}`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        key,
        value,
        type: encrypted ? 'encrypted' : 'plain',
        target: target === 'dev' ? ['development', 'preview'] : ['production'],
      }),
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }
  }

  public async listTeams(): Promise<{ id: string; name: string; slug: string }[]> {
    const teams: { id: string; name: string; slug: string }[] = [];
    let until: string | undefined;

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    while (true) {
      const params = new URLSearchParams({ limit: '100' });

      if (until) {
        params.set('until', until);
      }

      const response = await fetch(`https://api.vercel.com/v2/teams?${params}`, {
        method: 'GET',
        headers: this.headers,
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const data = (await response.json()) as { teams: { id: string; name: string; slug: string }[]; pagination?: { next?: number | null } };

      teams.push(...data.teams.map(({ id, name, slug }) => ({ id, name, slug })));

      const next = data.pagination?.next;

      if (!next || data.teams.length === 0) {
        break;
      }

      until = String(next);
    }

    return teams;
  }

  public async listStores(): Promise<{ id: string; name: string; access: BucketAccess }[]> {
    const stores: { id: string; name: string; access: BucketAccess }[] = [];
    let until: string | undefined;

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    while (true) {
      const params = new URLSearchParams();

      if (this.#orgId) {
        params.set('teamId', this.#orgId);
      }

      if (until) {
        params.set('until', until);
      }

      const response = await fetch(`https://api.vercel.com/v1/storage/stores${params.size > 0 ? `?${params}` : ''}`, {
        method: 'GET',
        headers: this.headers,
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const data = (await response.json()) as {
        stores: { id: string; name: string; type: string; access?: BucketAccess }[];
        pagination?: { next?: number | null };
      };

      // Stores created before private Blob storage existed carry no access and are public.
      stores.push(...data.stores.filter(({ type }) => type === 'blob').map(({ id, name, access }) => ({ id, name, access: access ?? 'public' })));

      const next = data.pagination?.next;

      if (!next || data.stores.length === 0) {
        break;
      }

      until = String(next);
    }

    return stores;
  }

  public async createStore({
    name,
    access,
    region,
  }: {
    name: string;
    access: BucketAccess;
    region: string | undefined;
  }): Promise<{ id: string; name: string; access: BucketAccess }> {
    const response = await fetch(`https://api.vercel.com/v1/storage/stores/blob${this.query}`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ name, access, ...(region ? { region } : {}) }),
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const data = (await response.json()) as { store: { id: string; name?: string; access?: BucketAccess } };

    return { id: data.store.id, name: data.store.name ?? name, access: data.store.access ?? access };
  }

  public async getStoreToken({ id }: { id: string }): Promise<string> {
    const response = await fetch(`https://api.vercel.com/v1/storage/stores/${id}/secrets${this.query}`, {
      method: 'GET',
      headers: this.headers,
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const data = (await response.json()) as { rwToken: string };

    return data.rwToken;
  }

  private get headers(): { Authorization: string; ['Content-Type']: string } {
    return {
      Authorization: `Bearer ${this.#token}`,
      'Content-Type': 'application/json',
    };
  }

  private get query(): string {
    const params = new URLSearchParams();

    if (this.#orgId) {
      params.set('teamId', this.#orgId);
    }

    return params.toString() ? `?${params}` : '';
  }
}
