import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { waitForDeployment } from '#helpers/deploy/deno/wait-for-deployment.ts';

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

  it('resolves once the revision succeeds', async () => {
    poll({ json: { status: 'succeeded' } });

    const promise = waitForDeployment({ token: 't', revisionId: 'r' });

    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);

    await expect(promise).resolves.toBeUndefined();
  });

  it('keeps polling through intermediate states until success', async () => {
    const { calls } = poll({ json: { status: 'pending' } }, { json: { status: 'building' } }, { json: { status: 'succeeded' } });

    const promise = waitForDeployment({ token: 't', revisionId: 'r' });

    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3);

    await expect(promise).resolves.toBeUndefined();
    expect(calls).toHaveLength(3);
  });

  it('rejects when the revision fails', async () => {
    poll({ json: { status: 'failed', failure_reason: 'boom' } });

    const promise = waitForDeployment({ token: 't', revisionId: 'r' });
    const assertion = expect(promise).rejects.toThrow('Revision r failed: boom');

    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);

    await assertion;
  });

  it('rejects with an unknown reason when failure_reason is absent', async () => {
    poll({ json: { status: 'failed' } });

    const promise = waitForDeployment({ token: 't', revisionId: 'r' });
    const assertion = expect(promise).rejects.toThrow('Revision r failed: unknown');

    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);

    await assertion;
  });

  it('rejects when the revision is skipped', async () => {
    poll({ json: { status: 'skipped' } });

    const promise = waitForDeployment({ token: 't', revisionId: 'r' });
    const assertion = expect(promise).rejects.toThrow('Revision r was skipped.');

    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);

    await assertion;
  });

  it('rejects when the status request fails', async () => {
    poll({ ok: false, statusText: 'Bad Gateway' });

    const promise = waitForDeployment({ token: 't', revisionId: 'r' });
    const assertion = expect(promise).rejects.toThrow('Failed to fetch revision status: Bad Gateway');

    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);

    await assertion;
  });

  it('rejects when the deployment never becomes ready before the deadline', async () => {
    poll({ json: { status: 'pending' } });

    const promise = waitForDeployment({ token: 't', revisionId: 'r' });
    const assertion = expect(promise).rejects.toThrow('Deployment did not become ready within the time limit.');

    await vi.advanceTimersByTimeAsync(TIMEOUT_MS + POLL_INTERVAL_MS);

    await assertion;
  });
});
