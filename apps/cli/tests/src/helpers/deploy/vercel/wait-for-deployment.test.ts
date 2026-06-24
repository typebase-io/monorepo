import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { waitForDeployment } from '#helpers/deploy/vercel/wait-for-deployment.ts';

import { type MockFetchResult, mockFetch } from '#tests/helpers/mock-fetch.ts';

const POLL_INTERVAL_MS = 3_000;
const TIMEOUT_MS = 10 * 60 * 1_000;

describe('waitForDeployment', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const poll = (...responses: MockFetchResult[]) => {
    let call = 0;

    return mockFetch(() => responses[Math.min(call++, responses.length - 1)] ?? {});
  };

  it('resolves once the deployment is ready', async () => {
    poll({ json: { readyState: 'READY' } });

    const promise = waitForDeployment({ token: 't', deploymentId: 'dpl_1', orgId: 'team-1', type: 'normal' });
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);

    await expect(promise).resolves.toBeUndefined();
  });

  it('keeps polling through intermediate states until ready', async () => {
    const { calls } = poll({ json: { readyState: 'QUEUED' } }, { json: { readyState: 'BUILDING' } }, { json: { readyState: 'READY' } });

    const promise = waitForDeployment({ token: 't', deploymentId: 'dpl_1', orgId: undefined, type: 'normal' });
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3);

    await expect(promise).resolves.toBeUndefined();

    expect(calls).toHaveLength(3);
    expect(calls[0]?.url).toBe('https://api.vercel.com/v13/deployments/dpl_1');
  });

  it('rejects when the deployment errors', async () => {
    poll({ json: { readyState: 'ERROR' } });

    const promise = waitForDeployment({ token: 't', deploymentId: 'dpl_1', orgId: 'team-1', type: 'normal' });
    const assertion = expect(promise).rejects.toThrow('Deployment dpl_1 ended in ERROR state.');
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);

    await assertion;
  });

  it('rejects when the placeholder deployment is canceled', async () => {
    poll({ json: { readyState: 'CANCELED' } });

    const promise = waitForDeployment({ token: 't', deploymentId: 'dpl_1', orgId: 'team-1', type: 'placeholder' });
    const assertion = expect(promise).rejects.toThrow('Placeholder deployment dpl_1 was canceled.');
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);

    await assertion;
  });

  it('rejects when the deployment never becomes ready before the deadline', async () => {
    poll({ json: { readyState: 'BUILDING' } });

    const promise = waitForDeployment({ token: 't', deploymentId: 'dpl_1', orgId: undefined, type: 'normal' });
    const assertion = expect(promise).rejects.toThrow('deployment did not become ready within the time limit.');
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS + POLL_INTERVAL_MS);

    await assertion;
  });
});
