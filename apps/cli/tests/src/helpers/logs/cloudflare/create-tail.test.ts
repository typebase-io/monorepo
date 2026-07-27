import { afterEach, describe, expect, it, vi } from 'vitest';

import { createTail } from '#helpers/logs/cloudflare/create-tail.ts';

import { mockFetch } from '#tests/helpers/mock-fetch.ts';

const TAILS_URL = 'https://api.cloudflare.com/client/v4/accounts/acc-1/workers/scripts/my-worker/tails';

describe('createTail', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('starts a tail session and returns its websocket url', async () => {
    const { calls } = mockFetch(() => ({ json: { result: { id: 'tail-1', url: 'wss://tail.example.com/tail-1' } } }));

    const tail = await createTail({ token: 'cf-token', accountId: 'acc-1', scriptName: 'my-worker' });

    expect(tail?.url).toBe('wss://tail.example.com/tail-1');
    expect(calls[0]?.url).toBe(TAILS_URL);
    expect(calls[0]?.method).toBe('POST');
    expect(calls[0]?.headers).toEqual({ Authorization: 'Bearer cf-token', 'Content-Type': 'application/json' });
    expect(calls[0]?.body).toBe('{}');
  });

  it('deletes the tail session through the returned callback', async () => {
    const { calls } = mockFetch(() => ({ json: { result: { id: 'tail-1', url: 'wss://tail.example.com/tail-1' } } }));

    const tail = await createTail({ token: 'cf-token', accountId: 'acc-1', scriptName: 'my-worker' });

    await tail?.deleteTail();

    expect(calls[1]?.url).toBe(`${TAILS_URL}/tail-1`);
    expect(calls[1]?.method).toBe('DELETE');
    expect(calls[1]?.headers).toEqual({ Authorization: 'Bearer cf-token' });
  });

  it('returns undefined when the worker has never been deployed', async () => {
    mockFetch(() => ({ ok: false, status: 404, text: 'This Worker does not exist on your account.' }));

    await expect(createTail({ token: 'cf-token', accountId: 'acc-1', scriptName: 'my-worker' })).resolves.toBeUndefined();
  });

  it('throws when starting the tail session fails', async () => {
    mockFetch(() => ({ ok: false, status: 403, text: 'insufficient permissions' }));

    await expect(createTail({ token: 'cf-token', accountId: 'acc-1', scriptName: 'my-worker' })).rejects.toThrow('insufficient permissions');
  });
});
