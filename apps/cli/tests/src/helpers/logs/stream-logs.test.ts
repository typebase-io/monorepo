import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { streamCloudflareLogs } from '#helpers/logs/cloudflare/index.ts';
import { streamDenoLogs } from '#helpers/logs/deno/index.ts';
import { streamLogs } from '#helpers/logs/stream-logs.ts';
import { streamVercelLogs } from '#helpers/logs/vercel/index.ts';

vi.mock('#helpers/logs/cloudflare/index.ts', () => ({ streamCloudflareLogs: vi.fn() }));
vi.mock('#helpers/logs/deno/index.ts', () => ({ streamDenoLogs: vi.fn() }));
vi.mock('#helpers/logs/vercel/index.ts', () => ({ streamVercelLogs: vi.fn() }));

const createFakeStdin = () => {
  const handlers = new Map<string, ((data: Buffer) => void)[]>();

  return {
    isTTY: true,
    setRawMode: vi.fn(),
    resume: vi.fn(),
    pause: vi.fn(),
    on: vi.fn((event: string, handler: (data: Buffer) => void) => {
      handlers.set(event, [...(handlers.get(event) ?? []), handler]);
    }),
    off: vi.fn((event: string, handler: (data: Buffer) => void) => {
      handlers.set(
        event,
        (handlers.get(event) ?? []).filter((registered) => registered !== handler)
      );
    }),
    press: (key: string) => {
      for (const handler of handlers.get('data') ?? []) {
        handler(Buffer.from(key));
      }
    },
  };
};

const streamUntilAborted = ({ signal }: { signal: AbortSignal }) =>
  new Promise<void>((resolve) => {
    if (signal.aborted) {
      resolve();

      return;
    }

    signal.addEventListener('abort', () => {
      resolve();
    });
  });

describe('streamLogs', () => {
  let stdin: ReturnType<typeof createFakeStdin>;
  let originalStdin: PropertyDescriptor | undefined;

  const signal = () => vi.mocked(streamVercelLogs).mock.calls[0]?.[0]?.signal;

  const start = async () => {
    const promise = streamLogs({ target: 'dev', provider: 'vercel' });

    await vi.waitFor(() => {
      expect(streamVercelLogs).toHaveBeenCalled();
    });

    return { promise };
  };

  beforeEach(() => {
    vi.clearAllMocks();

    stdin = createFakeStdin();
    originalStdin = Object.getOwnPropertyDescriptor(process, 'stdin');

    Object.defineProperty(process, 'stdin', { value: stdin, configurable: true });

    vi.mocked(streamVercelLogs).mockImplementation(streamUntilAborted);
    vi.mocked(streamDenoLogs).mockResolvedValue(undefined);
    vi.mocked(streamCloudflareLogs).mockResolvedValue(undefined);
  });

  afterEach(() => {
    if (originalStdin) {
      Object.defineProperty(process, 'stdin', originalStdin);
    }

    vi.restoreAllMocks();
  });

  describe('routes to the provider helper', () => {
    it('streams vercel logs with an abort signal', async () => {
      const { promise } = await start();

      expect(streamVercelLogs).toHaveBeenCalledWith(expect.objectContaining({ target: 'dev' }));
      expect(signal()).toBeInstanceOf(AbortSignal);

      stdin.press('x');
      await promise;
    });

    it('streams deno logs', async () => {
      await streamLogs({ target: 'prod', provider: 'deno' });

      expect(streamDenoLogs).toHaveBeenCalledWith(expect.objectContaining({ target: 'prod' }));
      expect(streamVercelLogs).not.toHaveBeenCalled();
      expect(streamCloudflareLogs).not.toHaveBeenCalled();
    });

    it('streams cloudflare logs', async () => {
      await streamLogs({ target: 'dev', provider: 'cloudflare' });

      expect(streamCloudflareLogs).toHaveBeenCalledWith(expect.objectContaining({ target: 'dev' }));
      expect(streamVercelLogs).not.toHaveBeenCalled();
      expect(streamDenoLogs).not.toHaveBeenCalled();
    });

    it('propagates a failure from the provider helper', async () => {
      vi.mocked(streamVercelLogs).mockRejectedValue(new Error('boom'));

      await expect(streamLogs({ target: 'dev', provider: 'vercel' })).rejects.toThrow('boom');
    });
  });

  describe('on a terminal', () => {
    it('switches the terminal to raw mode while streaming and restores it afterwards', async () => {
      const { promise } = await start();

      expect(stdin.setRawMode).toHaveBeenCalledWith(true);
      expect(stdin.resume).toHaveBeenCalledOnce();
      expect(stdin.on).toHaveBeenCalledWith('data', expect.any(Function));
      expect(stdin.pause).not.toHaveBeenCalled();

      stdin.press('x');
      await promise;

      expect(stdin.setRawMode).toHaveBeenLastCalledWith(false);
      expect(stdin.off).toHaveBeenCalledWith('data', expect.any(Function));
      expect(stdin.pause).toHaveBeenCalledOnce();
    });

    it.each([
      { name: '"x"', key: 'x' },
      { name: '"X"', key: 'X' },
      { name: 'Ctrl+C', key: '\u0003' },
    ])('stops the stream when $name is pressed', async ({ key }) => {
      const { promise } = await start();

      stdin.press(key);

      await promise;

      expect(signal()?.aborted).toBe(true);
    });

    it('keeps streaming when any other key is pressed', async () => {
      const { promise } = await start();

      stdin.press('a');

      expect(signal()?.aborted).toBe(false);

      stdin.press('x');
      await promise;
    });

    it('stops the stream on SIGINT', async () => {
      const onSpy = vi.spyOn(process, 'on');
      const { promise } = await start();

      const onSigint = onSpy.mock.calls.find(([event]) => event === 'SIGINT')?.[1];

      onSigint?.();
      await promise;

      expect(signal()?.aborted).toBe(true);
    });

    it('keeps listening for SIGINT after the first one', async () => {
      const onSpy = vi.spyOn(process, 'on');
      const { promise } = await start();

      const sigintRegistrations = onSpy.mock.calls.filter(([event]) => event === 'SIGINT');

      expect(sigintRegistrations).toHaveLength(1);
      expect(process.listenerCount('SIGINT')).toBeGreaterThan(0);

      stdin.press('x');
      await promise;
    });

    it('restores the terminal if the process exits without unwinding', async () => {
      let endStream: (() => void) | undefined;

      vi.mocked(streamVercelLogs).mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            endStream = resolve;
          })
      );

      const onSpy = vi.spyOn(process, 'on');
      const { promise } = await start();

      const onExit = onSpy.mock.calls.find(([event]) => event === 'exit')?.[1];

      onExit?.();

      expect(stdin.setRawMode).toHaveBeenLastCalledWith(false);
      expect(stdin.pause).toHaveBeenCalledOnce();

      endStream?.();
      await promise;

      expect(stdin.pause).toHaveBeenCalledOnce();
    });

    it('stops listening on the process once the stream ends', async () => {
      const sigintBefore = process.listenerCount('SIGINT');
      const exitBefore = process.listenerCount('exit');

      const { promise } = await start();

      stdin.press('x');
      await promise;

      expect(process.listenerCount('SIGINT')).toBe(sigintBefore);
      expect(process.listenerCount('exit')).toBe(exitBefore);
    });

    it('restores the terminal when the stream fails', async () => {
      vi.mocked(streamVercelLogs).mockRejectedValue(new Error('boom'));

      await expect(streamLogs({ target: 'dev', provider: 'vercel' })).rejects.toThrow('boom');

      expect(stdin.setRawMode).toHaveBeenLastCalledWith(false);
      expect(stdin.pause).toHaveBeenCalledOnce();
    });

    it('leaves a non-interactive stdin untouched', async () => {
      Object.defineProperty(process, 'stdin', { value: { ...stdin, isTTY: false }, configurable: true });

      await streamLogs({ target: 'dev', provider: 'deno' });

      expect(stdin.setRawMode).not.toHaveBeenCalled();
      expect(stdin.on).not.toHaveBeenCalled();
      expect(stdin.pause).not.toHaveBeenCalled();
    });
  });
});
