export interface CloudflareTokenPolicy {
  effect: 'allow' | 'deny';
  permission_groups: { id: string }[];
  resources: Record<string, string>;
}

export class CloudflareClient {
  #token: string;
  #accountId: string | undefined;

  public constructor({ token, accountId }: { token: string; accountId: string | undefined }) {
    this.#token = token;
    this.#accountId = accountId;
  }

  public async listAccounts(): Promise<{ id: string; name: string }[]> {
    const accounts: { id: string; name: string }[] = [];

    for (let page = 1; ; page++) {
      const data = await this.request(`https://api.cloudflare.com/client/v4/accounts?${new URLSearchParams({ per_page: '50', page: String(page) })}`);
      const result = data.result as { id: string; name: string }[];

      accounts.push(...result.map(({ id, name }) => ({ id, name })));

      if (result.length === 0 || page >= (data.result_info?.total_pages ?? page)) {
        return accounts;
      }
    }
  }

  public async listR2Buckets(): Promise<string[]> {
    const names: string[] = [];
    let cursor: string | undefined;

    do {
      const params = new URLSearchParams({ per_page: '1000' });

      if (cursor) {
        params.set('cursor', cursor);
      }

      const data = await this.request(`${this.accountUrl}/r2/buckets?${params}`);

      names.push(...(data.result as { buckets: { name: string }[] }).buckets.map(({ name }) => name));
      cursor = data.result_info?.cursor;
    } while (cursor);

    return names;
  }

  public async createR2Bucket({ name, locationHint }: { name: string; locationHint: string | undefined }): Promise<void> {
    await this.request(`${this.accountUrl}/r2/buckets`, {
      method: 'POST',
      body: JSON.stringify({ name, ...(locationHint ? { locationHint } : {}) }),
    });
  }

  public async getR2ManagedDomain({ name }: { name: string }): Promise<{ domain: string; enabled: boolean }> {
    const { result } = await this.request(`${this.accountUrl}/r2/buckets/${name}/domains/managed`);
    const { domain, enabled } = result as { domain: string; enabled: boolean };

    return { domain, enabled };
  }

  public async enableR2ManagedDomain({ name }: { name: string }): Promise<{ domain: string; enabled: boolean }> {
    const { result } = await this.request(`${this.accountUrl}/r2/buckets/${name}/domains/managed`, {
      method: 'PUT',
      body: JSON.stringify({ enabled: true }),
    });

    const { domain, enabled } = result as { domain: string; enabled: boolean };

    return { domain, enabled };
  }

  public async getPermissionGroupIds(names: string[]): Promise<string[]> {
    const { result } = await this.request(`${this.accountUrl}/tokens/permission_groups`);
    const groups = result as { id: string; name: string }[];

    return names.map((name) => {
      const group = groups.find((candidate) => candidate.name === name);

      if (!group) {
        throw new Error(`Cloudflare did not return the permission group \`${name}\`.`);
      }

      return group.id;
    });
  }

  public async createAccountToken({ name, policies }: { name: string; policies: CloudflareTokenPolicy[] }): Promise<{ id: string; value: string }> {
    const { result } = await this.request(`${this.accountUrl}/tokens`, {
      method: 'POST',
      body: JSON.stringify({ name, policies }),
    });

    const { id, value } = result as { id: string; value: string };

    return { id, value };
  }

  public async getAccountToken({ id }: { id: string }): Promise<{ id: string; name: string; policies: CloudflareTokenPolicy[] } | undefined> {
    const response = await fetch(`${this.accountUrl}/tokens/${id}`, { method: 'GET', headers: this.headers });

    if (response.status === 404) {
      return undefined;
    }

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const data = (await response.json()) as { result: { id: string; name: string; policies: CloudflareTokenPolicy[] } };

    return { id: data.result.id, name: data.result.name, policies: data.result.policies };
  }

  public async updateAccountToken({ id, name, policies }: { id: string; name: string; policies: CloudflareTokenPolicy[] }): Promise<void> {
    await this.request(`${this.accountUrl}/tokens/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name, policies }),
    });
  }

  private async request(
    url: string,
    init: { method?: string; body?: string } = {}
  ): Promise<{ result: unknown; result_info?: { cursor?: string; total_pages?: number } }> {
    const response = await fetch(url, { method: init.method ?? 'GET', headers: this.headers, ...(init.body ? { body: init.body } : {}) });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    return (await response.json()) as { result: unknown; result_info?: { cursor?: string; total_pages?: number } };
  }

  private get accountUrl(): string {
    if (!this.#accountId) {
      throw new Error('This Cloudflare request needs an account id.');
    }

    return `https://api.cloudflare.com/client/v4/accounts/${this.#accountId}`;
  }

  private get headers(): { Authorization: string; ['Content-Type']: string } {
    return {
      Authorization: `Bearer ${this.#token}`,
      'Content-Type': 'application/json',
    };
  }
}
