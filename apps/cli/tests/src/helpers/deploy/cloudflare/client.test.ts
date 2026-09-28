import { afterEach, describe, expect, it, vi } from 'vitest';

import { CloudflareClient, type CloudflareTokenPolicy } from '#helpers/deploy/cloudflare/client.ts';

import { mockFetch } from '#tests/helpers/mock-fetch.ts';

const HEADERS = { Authorization: 'Bearer cf-token', 'Content-Type': 'application/json' };

const ACCOUNT = 'https://api.cloudflare.com/client/v4/accounts/acc_1';

describe('CloudflareClient storage', () => {
  const client = new CloudflareClient({ token: 'cf-token', accountId: 'acc_1' });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('lists the accounts the token can reach, following pagination', async () => {
    const { calls } = mockFetch((url) =>
      url.includes('page=2')
        ? { json: { result: [{ id: 'acc_2', name: 'Beta' }], result_info: { page: 2, total_pages: 2 } } }
        : { json: { result: [{ id: 'acc_1', name: 'Acme' }], result_info: { page: 1, total_pages: 2 } } }
    );

    await expect(new CloudflareClient({ token: 'cf-token', accountId: undefined }).listAccounts()).resolves.toEqual([
      { id: 'acc_1', name: 'Acme' },
      { id: 'acc_2', name: 'Beta' },
    ]);

    expect(calls.map(({ url, method, headers }) => ({ url, method, headers }))).toEqual([
      { url: 'https://api.cloudflare.com/client/v4/accounts?per_page=50&page=1', method: 'GET', headers: HEADERS },
      { url: 'https://api.cloudflare.com/client/v4/accounts?per_page=50&page=2', method: 'GET', headers: HEADERS },
    ]);
  });

  it('stops after one page when the response carries no pagination', async () => {
    const { calls } = mockFetch(() => ({ json: { result: [{ id: 'acc_1', name: 'Acme' }] } }));

    await expect(client.listAccounts()).resolves.toEqual([{ id: 'acc_1', name: 'Acme' }]);

    expect(calls).toHaveLength(1);
  });

  it('refuses an account request without an account id, before reaching Cloudflare', async () => {
    const { calls } = mockFetch(() => ({ json: { result: [] } }));

    await expect(new CloudflareClient({ token: 'cf-token', accountId: undefined }).listR2Buckets()).rejects.toThrow(
      'This Cloudflare request needs an account id.'
    );

    expect(calls).toHaveLength(0);
  });

  it('throws when listing accounts fails', async () => {
    mockFetch(() => ({ ok: false, status: 403, text: 'forbidden' }));

    await expect(client.listAccounts()).rejects.toThrow('forbidden');
  });

  it('lists the R2 buckets of the account, following the cursor', async () => {
    const { calls } = mockFetch((url) =>
      url.includes('cursor=')
        ? { json: { result: { buckets: [{ name: 'app-documents-dev' }] }, result_info: { per_page: 1000 } } }
        : { json: { result: { buckets: [{ name: 'app-avatars-dev' }] }, result_info: { cursor: 'next-page', per_page: 1000 } } }
    );

    await expect(client.listR2Buckets()).resolves.toEqual(['app-avatars-dev', 'app-documents-dev']);

    expect(calls.map(({ url, method, headers }) => ({ url, method, headers }))).toEqual([
      { url: `${ACCOUNT}/r2/buckets?per_page=1000`, method: 'GET', headers: HEADERS },
      { url: `${ACCOUNT}/r2/buckets?per_page=1000&cursor=next-page`, method: 'GET', headers: HEADERS },
    ]);
  });

  it('throws when listing R2 buckets fails', async () => {
    mockFetch(() => ({ ok: false, status: 500, text: 'r2 unavailable' }));

    await expect(client.listR2Buckets()).rejects.toThrow('r2 unavailable');
  });

  it('creates an R2 bucket with its location hint', async () => {
    const { calls } = mockFetch(() => ({ json: { result: { name: 'app-avatars-dev', location: 'WEUR' } } }));

    await client.createR2Bucket({ name: 'app-avatars-dev', locationHint: 'weur' });

    expect(calls).toEqual([
      {
        url: `${ACCOUNT}/r2/buckets`,
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({ name: 'app-avatars-dev', locationHint: 'weur' }),
        rawBody: JSON.stringify({ name: 'app-avatars-dev', locationHint: 'weur' }),
      },
    ]);
  });

  it('creates an R2 bucket without a location hint when none is declared', async () => {
    const { calls } = mockFetch(() => ({ json: { result: { name: 'app-documents-dev' } } }));

    await client.createR2Bucket({ name: 'app-documents-dev', locationHint: undefined });

    expect(calls[0]?.body).toBe(JSON.stringify({ name: 'app-documents-dev' }));
  });

  it('throws when creating an R2 bucket fails', async () => {
    mockFetch(() => ({ ok: false, status: 409, text: 'bucket name taken' }));

    await expect(client.createR2Bucket({ name: 'app-avatars-dev', locationHint: undefined })).rejects.toThrow('bucket name taken');
  });

  it("reads a bucket's r2.dev domain and whether it is enabled", async () => {
    const { calls } = mockFetch(() => ({ json: { result: { bucketId: 'b_1', domain: 'pub-abc.r2.dev', enabled: true } } }));

    await expect(client.getR2ManagedDomain({ name: 'app-avatars-dev' })).resolves.toEqual({ domain: 'pub-abc.r2.dev', enabled: true });

    expect(calls).toEqual([
      { url: `${ACCOUNT}/r2/buckets/app-avatars-dev/domains/managed`, method: 'GET', headers: HEADERS, body: undefined, rawBody: undefined },
    ]);
  });

  it('throws when reading the r2.dev domain fails', async () => {
    mockFetch(() => ({ ok: false, status: 404, text: 'bucket not found' }));

    await expect(client.getR2ManagedDomain({ name: 'app-avatars-dev' })).rejects.toThrow('bucket not found');
  });

  it("enables a bucket's r2.dev domain", async () => {
    const { calls } = mockFetch(() => ({ json: { result: { bucketId: 'b_1', domain: 'pub-abc.r2.dev', enabled: true } } }));

    await expect(client.enableR2ManagedDomain({ name: 'app-avatars-dev' })).resolves.toEqual({ domain: 'pub-abc.r2.dev', enabled: true });

    expect(calls).toEqual([
      {
        url: `${ACCOUNT}/r2/buckets/app-avatars-dev/domains/managed`,
        method: 'PUT',
        headers: HEADERS,
        body: JSON.stringify({ enabled: true }),
        rawBody: JSON.stringify({ enabled: true }),
      },
    ]);
  });

  it('throws when enabling the r2.dev domain fails', async () => {
    mockFetch(() => ({ ok: false, status: 403, text: 'not allowed' }));

    await expect(client.enableR2ManagedDomain({ name: 'app-avatars-dev' })).rejects.toThrow('not allowed');
  });

  it('finds the ids of permission groups by name', async () => {
    const { calls } = mockFetch(() => ({
      json: {
        result: [
          { id: 'pg_read', name: 'Workers R2 Storage Bucket Item Read' },
          { id: 'pg_write', name: 'Workers R2 Storage Bucket Item Write' },
          { id: 'pg_other', name: 'Workers Scripts Write' },
        ],
      },
    }));

    await expect(client.getPermissionGroupIds(['Workers R2 Storage Bucket Item Write', 'Workers R2 Storage Bucket Item Read'])).resolves.toEqual([
      'pg_write',
      'pg_read',
    ]);

    expect(calls).toEqual([{ url: `${ACCOUNT}/tokens/permission_groups`, method: 'GET', headers: HEADERS, body: undefined, rawBody: undefined }]);
  });

  it('throws naming a permission group the account does not offer', async () => {
    mockFetch(() => ({ json: { result: [{ id: 'pg_read', name: 'Workers R2 Storage Bucket Item Read' }] } }));

    await expect(client.getPermissionGroupIds(['Workers R2 Storage Bucket Item Write'])).rejects.toThrow(
      'Cloudflare did not return the permission group `Workers R2 Storage Bucket Item Write`.'
    );
  });

  it('throws when listing permission groups fails', async () => {
    mockFetch(() => ({ ok: false, status: 403, text: 'missing API Tokens permission' }));

    await expect(client.getPermissionGroupIds([])).rejects.toThrow('missing API Tokens permission');
  });

  const POLICIES: CloudflareTokenPolicy[] = [
    {
      effect: 'allow',
      permission_groups: [{ id: 'pg_write' }, { id: 'pg_read' }],
      resources: { 'com.cloudflare.edge.r2.bucket.acc_1_default_app-avatars-dev': '*' },
    },
  ];

  it('creates an account API token and returns its id and value', async () => {
    const { calls } = mockFetch(() => ({
      json: { result: { id: 'tok_1', name: 'typebase-storage-app-dev', value: 'secret-value', policies: POLICIES } },
    }));

    await expect(client.createAccountToken({ name: 'typebase-storage-app-dev', policies: POLICIES })).resolves.toEqual({
      id: 'tok_1',
      value: 'secret-value',
    });

    expect(calls).toEqual([
      {
        url: `${ACCOUNT}/tokens`,
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({ name: 'typebase-storage-app-dev', policies: POLICIES }),
        rawBody: JSON.stringify({ name: 'typebase-storage-app-dev', policies: POLICIES }),
      },
    ]);
  });

  it('throws when creating an account API token fails', async () => {
    mockFetch(() => ({ ok: false, status: 403, text: 'cannot create tokens' }));

    await expect(client.createAccountToken({ name: 'typebase-storage-app-dev', policies: POLICIES })).rejects.toThrow('cannot create tokens');
  });

  it('reads an account API token by id', async () => {
    const { calls } = mockFetch(() => ({
      json: { result: { id: 'tok_1', name: 'typebase-storage-app-dev', status: 'active', policies: POLICIES } },
    }));

    await expect(client.getAccountToken({ id: 'tok_1' })).resolves.toEqual({ id: 'tok_1', name: 'typebase-storage-app-dev', policies: POLICIES });

    expect(calls).toEqual([{ url: `${ACCOUNT}/tokens/tok_1`, method: 'GET', headers: HEADERS, body: undefined, rawBody: undefined }]);
  });

  it('returns undefined when the account API token does not exist', async () => {
    mockFetch(() => ({ ok: false, status: 404, text: 'not found' }));

    await expect(client.getAccountToken({ id: 'tok_gone' })).resolves.toBeUndefined();
  });

  it('throws when reading an account API token fails', async () => {
    mockFetch(() => ({ ok: false, status: 500, text: 'tokens unavailable' }));

    await expect(client.getAccountToken({ id: 'tok_1' })).rejects.toThrow('tokens unavailable');
  });

  it("replaces an account API token's policies in place", async () => {
    const { calls } = mockFetch(() => ({ json: { result: { id: 'tok_1', name: 'typebase-storage-app-dev', policies: POLICIES } } }));

    await client.updateAccountToken({ id: 'tok_1', name: 'typebase-storage-app-dev', policies: POLICIES });

    expect(calls).toEqual([
      {
        url: `${ACCOUNT}/tokens/tok_1`,
        method: 'PUT',
        headers: HEADERS,
        body: JSON.stringify({ name: 'typebase-storage-app-dev', policies: POLICIES }),
        rawBody: JSON.stringify({ name: 'typebase-storage-app-dev', policies: POLICIES }),
      },
    ]);
  });

  it('throws when updating an account API token fails', async () => {
    mockFetch(() => ({ ok: false, status: 403, text: 'cannot edit tokens' }));

    await expect(client.updateAccountToken({ id: 'tok_1', name: 'typebase-storage-app-dev', policies: POLICIES })).rejects.toThrow(
      'cannot edit tokens'
    );
  });
});
