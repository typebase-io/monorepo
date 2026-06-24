import { afterEach, describe, expect, it } from 'vitest';

import { enableWorkerSubdomain } from '#helpers/deploy/cloudflare/enable-worker-subdomain.ts';

import { mockFetch } from '#tests/helpers/mock-fetch.ts';

describe('enableWorkerSubdomain', () => {
  afterEach(() => {
    mockFetch(() => ({})).restore();
  });

  it('POSTs an enable request to the worker subdomain endpoint with the bearer token', async () => {
    const { calls } = mockFetch(() => ({ ok: true }));

    await enableWorkerSubdomain({ token: 'cf-token', accountId: 'acc-123', workerName: 'my-worker' });

    expect(calls).toHaveLength(1);

    const [call] = calls;

    expect(call?.url).toBe('https://api.cloudflare.com/client/v4/accounts/acc-123/workers/scripts/my-worker/subdomain');
    expect(call?.method).toBe('POST');
    expect(call?.headers).toMatchObject({ Authorization: 'Bearer cf-token', 'Content-Type': 'application/json' });
    expect(call?.body).toBe(JSON.stringify({ enabled: true }));
  });
});
