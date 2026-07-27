import ora from 'ora';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getCloudflareToken } from '#helpers/deploy/cloudflare/get-cloudflare-token.ts';
import { getCloudflareWorker } from '#helpers/deploy/cloudflare/get-cloudflare-worker.ts';
import { createTail } from '#helpers/logs/cloudflare/create-tail.ts';
import { streamCloudflareLogs } from '#helpers/logs/cloudflare/index.ts';
import { listenUntilClosed } from '#helpers/logs/cloudflare/listen-until-closed.ts';

vi.mock('#helpers/deploy/cloudflare/get-cloudflare-token.ts', () => ({ getCloudflareToken: vi.fn() }));
vi.mock('#helpers/deploy/cloudflare/get-cloudflare-worker.ts', () => ({ getCloudflareWorker: vi.fn() }));
vi.mock('#helpers/logs/cloudflare/create-tail.ts', () => ({ createTail: vi.fn() }));
vi.mock('#helpers/logs/cloudflare/listen-until-closed.ts', () => ({ listenUntilClosed: vi.fn() }));

const deleteTail = vi.fn();

const listenUntilAborted = ({ signal }: { signal: AbortSignal }) =>
  new Promise<void>((resolve) => {
    if (signal.aborted) {
      resolve();

      return;
    }

    signal.addEventListener('abort', () => {
      resolve();
    });
  });

describe('streamCloudflareLogs', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.stubGlobal(
      'WebSocket',
      class FakeWebSocket {
        public binaryType = 'arraybuffer';
      }
    );

    vi.mocked(getCloudflareToken).mockResolvedValue('cf-token');
    vi.mocked(getCloudflareWorker).mockResolvedValue({ accountId: 'acc-1', workerName: 'my-worker', subdomain: 'acme' });
    vi.mocked(createTail).mockResolvedValue({ url: 'wss://tail.example.com/tail-1', deleteTail });
    vi.mocked(listenUntilClosed).mockImplementation(listenUntilAborted);
    deleteTail.mockResolvedValue(undefined);
  });

  afterEach(() => {
    process.exitCode = 0;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('tails the preview worker for the dev target', async () => {
    const abort = new AbortController();
    const promise = streamCloudflareLogs({ target: 'dev', signal: abort.signal });

    await vi.waitFor(() => {
      expect(listenUntilClosed).toHaveBeenCalled();
    });

    expect(getCloudflareToken).toHaveBeenCalledOnce();
    expect(getCloudflareWorker).toHaveBeenCalledWith('cf-token');
    expect(createTail).toHaveBeenCalledWith({ token: 'cf-token', accountId: 'acc-1', scriptName: 'my-worker-preview' });
    expect(listenUntilClosed).toHaveBeenCalledWith({ url: 'wss://tail.example.com/tail-1', signal: abort.signal });

    abort.abort();
    await promise;
  });

  it('tails the production worker for the prod target', async () => {
    const abort = new AbortController();
    const promise = streamCloudflareLogs({ target: 'prod', signal: abort.signal });

    await vi.waitFor(() => {
      expect(createTail).toHaveBeenCalledWith({ token: 'cf-token', accountId: 'acc-1', scriptName: 'my-worker' });
    });

    abort.abort();
    await promise;
  });

  it('shows a spinner while the tail session is being closed', async () => {
    const abort = new AbortController();
    const promise = streamCloudflareLogs({ target: 'dev', signal: abort.signal });

    await vi.waitFor(() => {
      expect(listenUntilClosed).toHaveBeenCalled();
    });

    vi.mocked(ora).mockClear();

    abort.abort();
    await promise;

    expect(ora).toHaveBeenCalledWith(expect.objectContaining({ text: 'Closing the log stream...' }));
    expect(vi.mocked(ora()).succeed.mock.calls.flat()).toContain('Log stream closed.');
  });

  it('does not show the closing spinner when reconnecting', async () => {
    const abort = new AbortController();

    vi.mocked(listenUntilClosed).mockResolvedValueOnce(undefined).mockImplementation(listenUntilAborted);

    const promise = streamCloudflareLogs({ target: 'dev', signal: abort.signal });

    await vi.waitFor(
      () => {
        expect(listenUntilClosed).toHaveBeenCalledTimes(2);
      },
      { timeout: 3_000 }
    );

    expect(ora).not.toHaveBeenCalledWith(expect.objectContaining({ text: 'Closing the log stream...' }));

    abort.abort();
    await promise;
  });

  it('deletes the tail session when aborted', async () => {
    const abort = new AbortController();
    const promise = streamCloudflareLogs({ target: 'dev', signal: abort.signal });

    await vi.waitFor(() => {
      expect(listenUntilClosed).toHaveBeenCalled();
    });

    abort.abort();
    await promise;

    expect(deleteTail).toHaveBeenCalledOnce();
  });

  it('opens a fresh tail session when the connection closes', async () => {
    const abort = new AbortController();

    vi.mocked(listenUntilClosed).mockResolvedValueOnce(undefined).mockImplementation(listenUntilAborted);
    vi.mocked(createTail)
      .mockResolvedValueOnce({ url: 'wss://tail.example.com/tail-1', deleteTail })
      .mockResolvedValue({ url: 'wss://tail.example.com/tail-2', deleteTail });

    const promise = streamCloudflareLogs({ target: 'dev', signal: abort.signal });

    await vi.waitFor(
      () => {
        expect(listenUntilClosed).toHaveBeenCalledTimes(2);
      },
      { timeout: 3_000 }
    );

    expect(createTail).toHaveBeenCalledTimes(2);
    expect(deleteTail).toHaveBeenCalledOnce();
    expect(listenUntilClosed).toHaveBeenLastCalledWith({ url: 'wss://tail.example.com/tail-2', signal: abort.signal });

    abort.abort();
    await promise;
  });

  it('fails without connecting when the worker was never deployed', async () => {
    vi.mocked(createTail).mockResolvedValue(undefined);

    await streamCloudflareLogs({ target: 'prod', signal: new AbortController().signal });

    expect(process.exitCode).toBe(1);
    expect(listenUntilClosed).not.toHaveBeenCalled();
  });

  it('throws when the worker disappears between reconnects', async () => {
    vi.mocked(listenUntilClosed).mockResolvedValue(undefined);
    vi.mocked(createTail).mockResolvedValueOnce({ url: 'wss://tail.example.com/tail-1', deleteTail }).mockResolvedValue(undefined);

    await expect(streamCloudflareLogs({ target: 'dev', signal: new AbortController().signal })).rejects.toThrow(
      'The worker "my-worker-preview" is no longer available on this Cloudflare account.'
    );
  });

  it('propagates connection failures after cleaning up the tail session', async () => {
    vi.mocked(listenUntilClosed).mockRejectedValue(new Error('The Cloudflare tail connection failed.'));

    await expect(streamCloudflareLogs({ target: 'dev', signal: new AbortController().signal })).rejects.toThrow(
      'The Cloudflare tail connection failed.'
    );

    expect(deleteTail).toHaveBeenCalledOnce();
  });

  it('throws when the global WebSocket is missing', async () => {
    vi.stubGlobal('WebSocket', undefined);

    await expect(streamCloudflareLogs({ target: 'dev', signal: new AbortController().signal })).rejects.toThrow('Node 22.4');

    expect(createTail).not.toHaveBeenCalled();
  });

  it('propagates worker lookup errors without starting a tail session', async () => {
    vi.mocked(getCloudflareWorker).mockRejectedValue(new Error('worker failed'));

    await expect(streamCloudflareLogs({ target: 'dev', signal: new AbortController().signal })).rejects.toThrow('worker failed');

    expect(createTail).not.toHaveBeenCalled();
  });
});
