import { afterEach, describe, expect, it, vi } from 'vitest';

import { flushAnalytics } from '#helpers/analytics/flush-analytics.ts';

const { flush } = vi.hoisted(() => ({ flush: vi.fn(() => Promise.resolve()) }));

vi.mock('#helpers/analytics/posthog-client.ts', () => ({ postHogClient: { flush } }));

describe('flushAnalytics', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('sends the pending events', async () => {
    await flushAnalytics(1000);

    expect(flush).toHaveBeenCalledOnce();
  });

  it('resolves without printing anything when the events fail to send', async () => {
    const error = vi.spyOn(console, 'error');

    flush.mockRejectedValueOnce(new Error('Network error while fetching PostHog'));

    await expect(flushAnalytics(1000)).resolves.toBeUndefined();
    expect(error).not.toHaveBeenCalled();
  });

  it('stops waiting once the timeout passes', async () => {
    vi.useFakeTimers();

    flush.mockReturnValueOnce(new Promise(() => undefined));

    const done = vi.fn();
    const flushed = flushAnalytics(1000).then(done);

    await vi.advanceTimersByTimeAsync(999);

    expect(done).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    await flushed;

    expect(done).toHaveBeenCalledOnce();
  });
});
